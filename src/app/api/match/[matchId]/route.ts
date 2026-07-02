import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendRelationCancelledEmail } from "@/lib/email";

// DELETE /api/match/[matchId] — annulation unilatérale d'un match (section 48)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { missionA: true, missionB: true },
  });
  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

  // L'utilisateur doit faire partie du match
  if (match.profileAId !== profileId && match.profileBId !== profileId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Impossible d'annuler un contrat déjà confirmé
  // (pas de champ contratStatus en base → dérivé du briqueStatus de la mission)
  const confirmed =
    match.missionA?.briqueStatus === "CONFIRME" ||
    match.missionB?.briqueStatus === "CONFIRME";
  if (confirmed) {
    return NextResponse.json(
      { error: "Contrat confirmé — annulation impossible" },
      { status: 403 }
    );
  }

  const missionIds = [match.missionAId, match.missionBId].filter(Boolean) as string[];

  await prisma.$transaction([
    // Retirer les swipes réciproques → chacun pourra re-swiper le profil plus tard
    prisma.swipe.deleteMany({
      where: {
        swiperId: { in: [match.profileAId, match.profileBId] },
        swipedMissionId: { in: missionIds },
      },
    }),
    // Supprimer le match (les Message sont supprimés en cascade, les ratings passent à null)
    prisma.match.delete({ where: { id: matchId } }),
    // Les missions associées redeviennent disponibles dans les deux timelines
    ...(missionIds.length > 0
      ? [prisma.mission.updateMany({ where: { id: { in: missionIds } }, data: { briqueStatus: "RECHERCHE" } })]
      : []),
  ]);

  // Email "mise en relation annulée" à l'autre partie (fire-and-forget)
  const otherProfileId = match.profileAId === profileId ? match.profileBId : match.profileAId;
  const otherUser = await prisma.user.findFirst({
    where: { profile: { id: otherProfileId } },
    select: { email: true, emailOptIn: true },
  });
  if (otherUser) {
    await sendRelationCancelledEmail(otherUser.email, { optIn: otherUser.emailOptIn });
  }

  return NextResponse.json({ ok: true });
}
