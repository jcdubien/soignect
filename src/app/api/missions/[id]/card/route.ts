import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/missions/[id]/card — mission complète (profil + photos) + statut de l'utilisateur
// vis-à-vis de cette annonce (swipe / mise en relation). Sert la fiche détaillée hors carrousel.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const swiperId = session.user.profileId as string;

  const mission = await prisma.mission.findUnique({
    where: { id },
    select: {
      id: true, title: true, location: true, startDate: true, endDate: true,
      minMonths: true, missionType: true, bioTinder: true,
      profile: {
        select: {
          name: true, type: true, photoUrl: true,
          secondaryPhotoUrl1: true, secondaryPhotoUrl2: true, region: true, bioTinder: true,
        },
      },
    },
  });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const swipe = await prisma.swipe.findUnique({
    where: { swiperId_swipedMissionId: { swiperId, swipedMissionId: id } },
    select: { direction: true },
  });

  const match = await prisma.match.findFirst({
    where: {
      OR: [
        { profileAId: swiperId, missionBId: id },
        { profileBId: swiperId, missionBId: id },
        { profileAId: swiperId, missionAId: id },
        { profileBId: swiperId, missionAId: id },
      ],
    },
    select: { id: true },
  });

  return NextResponse.json({
    mission,
    relation: {
      swipeDirection: swipe?.direction ?? null,
      matchId: match?.id ?? null,
    },
  });
}
