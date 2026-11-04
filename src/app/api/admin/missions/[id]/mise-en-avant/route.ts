import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { periodeSuivante, posteEligible } from "@/lib/miseEnAvantPoste";

export const dynamic = "force-dynamic";

// Mise en avant payante d'un poste d'établissement (étape 6, 04/11) — posée par l'administrateur
// à réception du paiement (vente en ligne fermée). POST : 30 jours, ou 30 de plus à la suite de
// celle en cours. DELETE : retire la mise en avant en cours et celles qui la prolongent.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const { id } = await params;

  const mission = await prisma.mission.findUnique({
    where: { id },
    select: { id: true, profile: { select: { type: true, titulaireKind: true } } },
  });
  if (!mission) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
  if (!posteEligible(mission.profile)) {
    return NextResponse.json({ error: "Seuls les postes d'un établissement peuvent être mis en avant." }, { status: 400 });
  }

  const maintenant = new Date();
  const derniere = await prisma.miseEnAvantPoste.findFirst({
    where: { missionId: id, retireeLe: null, fin: { gt: maintenant } },
    orderBy: { fin: "desc" },
    select: { fin: true },
  });
  const { debut, fin } = periodeSuivante(maintenant, derniere?.fin ?? null);
  await prisma.miseEnAvantPoste.create({
    data: { missionId: id, debut, fin, creeParUserId: session!.user!.id as string },
  });
  return NextResponse.json({ jusquAu: fin.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const { id } = await params;
  const maintenant = new Date();
  // En cours ET à venir (prolongations) : un retrait arrête tout ce qui reste.
  const { count } = await prisma.miseEnAvantPoste.updateMany({
    where: { missionId: id, retireeLe: null, fin: { gt: maintenant } },
    data: { retireeLe: maintenant },
  });
  return NextResponse.json({ retirees: count });
}
