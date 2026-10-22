import { NextRequest, NextResponse } from "next/server";
import { retirerCases } from "@/lib/casesPriorite";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PalierOffre } from "@prisma/client";
import { inseeOfCommune, COMMUNES_GUADELOUPE } from "@/lib/communes";
import { nouveauJeton, synchroniserPrioritesApl } from "@/lib/pageClient";
import { LIBELLE_PALIER, limitesDuClient } from "@/lib/tarifsPartenaire";
import { appBaseUrl } from "@/lib/appUrl";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";

/** Validité du lien d'activation d'un éditeur créé ici — transmis par l'administrateur lui-même. */
const ACTIVATION_JOURS = 7;

export const dynamic = "force-dynamic";

// Pages clients côté administrateur (20/10) : ouvrir la page d'un client, régler son périmètre
// (borné par l'offre), régénérer un jeton, recalculer les priorités depuis l'APL.

const CODES_CONNUS = new Set(COMMUNES_GUADELOUPE.map(inseeOfCommune).filter((c): c is string => !!c));

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("perimetre"), clientId: z.string(), communes: z.array(z.string()).min(1) }),
  z.object({ action: z.literal("jeton"), clientId: z.string(), quel: z.enum(["public", "edition"]) }),
  z.object({ action: z.literal("apl"), clientId: z.string() }),
  z.object({ action: z.literal("demo"), clientId: z.string(), demo: z.boolean() }),
  z.object({ action: z.literal("accord"), clientId: z.string(), accord: z.enum(["OUI", "NON", "DEMO"]) }),
  z.object({
    action: z.literal("editeur-ajout"), clientId: z.string(),
    email: z.string().trim().toLowerCase().email().max(200),
    nom: z.string().trim().min(2).max(120),
    fonction: z.string().trim().max(120).optional(),
  }),
  z.object({ action: z.literal("editeur-retrait"), clientId: z.string(), editeurId: z.string() }),
  // Point 9 : palier rattaché à la structure ; null = celui de son type.
  z.object({ action: z.literal("palier"), clientId: z.string(), palier: z.nativeEnum(PalierOffre).nullable() }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const d = parsed.data;
  const client = await prisma.clientInstitutionnel.findUnique({ where: { id: d.clientId }, include: { page: true } });
  if (!client) return NextResponse.json({ error: "Client inconnu." }, { status: 404 });

  // ÉDITEURS NOMMÉS (section 314). Un compte existant est RATTACHÉ, sans être modifié. Sinon un
  // compte sans profil est créé, avec un lien d'activation (choix du mot de passe) rendu ICI,
  // une fois : l'administrateur le transmet lui-même — Soignect n'envoie aucun email.
  if (d.action === "editeur-ajout") {
    let user = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
    let activation: string | null = null;
    if (!user) {
      const jeton = randomBytes(32).toString("hex");
      user = await prisma.user.create({
        data: {
          email: d.email,
          // Mot de passe inconnu de tous : le compte ne s'ouvre que par le lien d'activation.
          passwordHash: await hash(randomBytes(24).toString("base64url"), 12),
          emailOptIn: false,
          resetToken: jeton,
          resetTokenExpiry: new Date(Date.now() + ACTIVATION_JOURS * 86400_000),
        },
        select: { id: true },
      });
      const retour = client.page ? `&return_to=${encodeURIComponent(`/gestion/${client.page.jetonEdition}`)}` : "";
      activation = `${appBaseUrl()}/reset-password?token=${jeton}${retour}`;
    }
    await prisma.editeurClient.upsert({
      where: { clientId_userId: { clientId: client.id, userId: user.id } },
      update: { nom: d.nom, fonction: d.fonction || null, retireLe: null },
      create: { clientId: client.id, userId: user.id, nom: d.nom, fonction: d.fonction || null, ajouteParId: session.user.id },
    });
    return NextResponse.json({ ok: true, activation });
  }
  if (d.action === "editeur-retrait") {
    const r = await prisma.editeurClient.updateMany({
      where: { id: d.editeurId, clientId: client.id, retireLe: null },
      data: { retireLe: new Date() },
    });
    if (r.count === 0) return NextResponse.json({ error: "Éditeur introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // Le palier ne réécrit rien : ses plafonds s'appliquent aux prochains ajouts (lib/casesPriorite).
  if (d.action === "palier") {
    await prisma.clientInstitutionnel.update({ where: { id: client.id }, data: { palier: d.palier } });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "perimetre") {
    const communes = Array.from(new Set(d.communes));
    if (communes.some((c) => !CODES_CONNUS.has(c))) {
      return NextResponse.json({ error: "Commune inconnue." }, { status: 400 });
    }
    const { palier, communesMax: max } = limitesDuClient(client);
    if (max !== null && communes.length > max) {
      return NextResponse.json({ error: `L'offre ${palier ? LIBELLE_PALIER[palier] : client.type} couvre ${max} commune${max > 1 ? "s" : ""} au plus.` }, { status: 400 });
    }
    await prisma.pageClient.upsert({
      where: { clientId: client.id },
      update: { communes },
      create: {
        clientId: client.id, communes, creeParId: session.user.id,
        jetonPublic: nouveauJeton(), jetonEdition: nouveauJeton(),
      },
    });
    // Le périmètre change les priorités APL : on les recalcule dans le même geste, sans quoi
    // une commune retirée resterait prioritaire.
    const bilan = await synchroniserPrioritesApl(client.id, session.user.id);
    return NextResponse.json({ ok: true, bilan });
  }

  if (!client.page) return NextResponse.json({ error: "Ce client n'a pas encore de page." }, { status: 409 });

  if (d.action === "jeton") {
    await prisma.pageClient.update({
      where: { clientId: client.id },
      data: d.quel === "public" ? { jetonPublic: nouveauJeton() } : { jetonEdition: nouveauJeton() },
    });
    return NextResponse.json({ ok: true });
  }

  // L'accord ne touche qu'à ce que la page PUBLIE (le nom) : rien à recalculer.
  if (d.action === "accord") {
    await prisma.pageClient.update({ where: { clientId: client.id }, data: { accord: d.accord } });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "demo") {
    await prisma.pageClient.update({ where: { clientId: client.id }, data: { demo: d.demo } });
    // Vers la démo : les priorités APL écrites sortent de la base (elles agissaient sur le fil).
    // Vers le réel : elles y entrent. Les priorités DÉCLARÉES ne bougent pas.
    if (d.demo) {
      const lignes = await prisma.prioriteTerritoriale.findMany({ where: { clientId: client.id, origine: "APL" } });
      const retirees = await retirerCases(lignes, client, { id: session.user.id, nom: "Administrateur Soignect" }, "Page passée en démonstration.");
      return NextResponse.json({ ok: true, bilan: { creees: 0, modifiees: 0, retirees, ignorees: 0 } });
    }
  }

  const bilan = await synchroniserPrioritesApl(client.id, session.user.id);
  return NextResponse.json({ ok: true, bilan });
}
