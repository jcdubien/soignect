import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { logTraceEvent } from "@/lib/trace";
import { PROFESSION_LABELS } from "@/lib/professions";

export const dynamic = "force-dynamic";

// Intérêt d'un soignant pour un besoin du territoire (24/10). POST : exprimer (consentement
// explicite exigé) ; DELETE : retirer. Les éditeurs de la structure sont prévenus dans la cloche,
// aucun email. La trace ne porte ni nom ni identifiant de personne.

async function contexte(id: string) {
  const session = await auth();
  if (!session?.user?.profileId) return { erreur: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const moi = await prisma.profile.findUnique({ where: { id: session.user.profileId }, select: { id: true, profession: true, type: true, titulaireKind: true } });
  const besoin = await prisma.besoinTerritoire.findUnique({
    where: { id },
    select: { id: true, statut: true, expireLe: true, profession: true, commune: true, clientId: true, client: { select: { page: { select: { jetonEdition: true } }, editeurs: { where: { retireLe: null }, select: { userId: true } } } } },
  });
  if (!moi || !besoin) return { erreur: NextResponse.json({ error: "Besoin introuvable." }, { status: 404 }) };
  if (moi.type === "TITULAIRE" && moi.titulaireKind === "STRUCTURE") return { erreur: NextResponse.json({ error: "Réservé aux soignants." }, { status: 403 }) };
  if (besoin.profession !== moi.profession) return { erreur: NextResponse.json({ error: "Ce besoin concerne une autre profession." }, { status: 403 }) };
  return { moi, besoin };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contexte((await params).id);
  if (c.erreur) return c.erreur;
  const { moi, besoin } = c;
  const d = z.object({ consentement: z.literal(true) }).safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Le consentement à la transmission de votre nom est nécessaire." }, { status: 400 });
  if (besoin.statut !== "PUBLIE" || !besoin.expireLe || besoin.expireLe <= new Date()) return NextResponse.json({ error: "Ce besoin n'est plus publié." }, { status: 409 });
  const deja = await prisma.besoinInteret.findUnique({ where: { besoinId_profileId: { besoinId: besoin.id, profileId: moi.id } } });
  if (!deja) {
    await prisma.besoinInteret.create({ data: { besoinId: besoin.id, profileId: moi.id } });
    const lien = besoin.client.page ? `/gestion/${besoin.client.page.jetonEdition}` : "/";
    await Promise.all(besoin.client.editeurs.map((e) => createNotification({
      userId: e.userId, type: "besoin",
      message: `Un·e ${PROFESSION_LABELS[moi.profession].toLowerCase()} s'intéresse à votre besoin du territoire à ${besoin.commune}.`,
      linkUrl: lien,
    })));
    logTraceEvent({ eventType: "BESOIN_INTERET", profession: moi.profession, commune: besoin.commune, metadata: { besoinId: besoin.id, clientId: besoin.clientId, evenement: "exprime" } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contexte((await params).id);
  if (c.erreur) return c.erreur;
  const n = await prisma.besoinInteret.deleteMany({ where: { besoinId: c.besoin.id, profileId: c.moi.id } });
  if (n.count > 0) logTraceEvent({ eventType: "BESOIN_INTERET", profession: c.moi.profession, commune: c.besoin.commune, metadata: { besoinId: c.besoin.id, clientId: c.besoin.clientId, evenement: "retire" } });
  return NextResponse.json({ ok: true });
}
