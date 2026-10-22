import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NatureRelationInstitutionnelle } from "@prisma/client";
import { inseeOfCommune, COMMUNES_GUADELOUPE } from "@/lib/communes";
import { nouveauJeton, rattacherEditeur } from "@/lib/pageClient";
import { LIBELLE_PALIER, limitesDuClient } from "@/lib/tarifsPartenaire";
import { REVUE_CONVERSION_MOIS } from "@/lib/partenariat";

export const dynamic = "force-dynamic";

// Demandes de partenariat côté administrateur (22/10) — voir lib/partenariat.
//
// CONVERTIR = trois gestes en un, dans cet ordre : client institutionnel (revue à 6 mois),
// page en DÉMONSTRATION (priorités calculées à l'affichage, rien d'écrit dans le fil, accord
// DEMO : nom non publié), éditeur nommé (le contact de la demande). Ni palier payant, ni
// priorité réelle, ni accord OUI : ce sont des décisions qui restent dans /admin/pages.

const CODES_CONNUS = new Set(COMMUNES_GUADELOUPE.map(inseeOfCommune).filter((c): c is string => !!c));

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("convertir"), id: z.string(),
    nom: z.string().trim().min(2).max(160),
    nature: z.nativeEnum(NatureRelationInstitutionnelle),
    communes: z.array(z.string()).min(1),
  }),
  z.object({ action: z.literal("classer"), id: z.string() }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide (au moins une commune)." }, { status: 400 });
  const d = parsed.data;

  const demande = await prisma.demandePartenariat.findUnique({ where: { id: d.id } });
  if (!demande) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (demande.statut !== "NOUVELLE") return NextResponse.json({ error: "Demande déjà traitée." }, { status: 409 });

  if (d.action === "classer") {
    await prisma.demandePartenariat.update({ where: { id: demande.id }, data: { statut: "CLASSEE", traiteeLe: new Date() } });
    return NextResponse.json({ ok: true });
  }

  const communes = Array.from(new Set(d.communes));
  if (communes.some((c) => !CODES_CONNUS.has(c))) return NextResponse.json({ error: "Commune inconnue." }, { status: 400 });
  const { palier, communesMax: max } = limitesDuClient({ type: demande.type });
  if (max !== null && communes.length > max) {
    return NextResponse.json({ error: `L'offre ${palier ? LIBELLE_PALIER[palier] : demande.type} couvre ${max} commune${max > 1 ? "s" : ""} au plus.` }, { status: 400 });
  }
  if (await prisma.clientInstitutionnel.findUnique({ where: { nom: d.nom }, select: { id: true } })) {
    return NextResponse.json({ error: `Un client « ${d.nom} » existe déjà — changez le nom ou rattachez la demande à la main.` }, { status: 409 });
  }

  const debut = new Date();
  const revue = new Date(debut);
  revue.setUTCMonth(revue.getUTCMonth() + REVUE_CONVERSION_MOIS);

  const client = await prisma.$transaction(async (tx) => {
    const c = await tx.clientInstitutionnel.create({
      data: {
        nom: d.nom, type: demande.type, nature: d.nature, debutLe: debut, revueLe: revue,
        note: `Demande de partenariat du ${demande.createdAt.toISOString().slice(0, 10)}.`,
        page: {
          create: {
            communes, professions: demande.professions, creeParId: session.user.id,
            jetonPublic: nouveauJeton(), jetonEdition: nouveauJeton(),
            demo: true, accord: "DEMO",
          },
        },
      },
      include: { page: { select: { jetonEdition: true } } },
    });
    await tx.demandePartenariat.update({
      where: { id: demande.id }, data: { statut: "CONVERTIE", clientId: c.id, traiteeLe: new Date() },
    });
    return c;
  });

  const { activation } = await rattacherEditeur(
    client, { email: demande.email, nom: demande.contactNom, fonction: demande.fonction }, session.user.id,
  );
  console.log(`[admin] demande de partenariat convertie — ${client.nom} (${client.type}), page en démonstration`);
  return NextResponse.json({ ok: true, clientId: client.id, activation });
}
