import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/tray — swipes RIGHT triés par affinityScore desc (meilleur match en premier)
export async function GET() {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const swiperId = session.user.profileId as string;

  const swipes = await prisma.swipe.findMany({
    where: { swiperId, direction: SwipeDirection.RIGHT },
    include: {
      swipedMission: { include: { profile: true } },
    },
    orderBy: [
      { affinityScore: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
  });

  const missionIds = swipes.map((s) => s.swipedMissionId);

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { profileAId: swiperId, missionBId: { in: missionIds } },
        { profileBId: swiperId, missionBId: { in: missionIds } },
        { profileAId: swiperId, missionAId: { in: missionIds } },
        { profileBId: swiperId, missionAId: { in: missionIds } },
      ],
    },
    select: {
      id: true, missionAId: true, missionBId: true, aiScore: true, createdAt: true, status: true,
      missionA: { select: { briqueStatus: true } },
      missionB: { select: { briqueStatus: true } },
    },
  });

  const result = swipes.map((s) => {
    const mId  = s.swipedMissionId;
    const match = matches.find((m) => m.missionAId === mId || m.missionBId === mId);
    // "Contrat confirmé" dérivé du briqueStatus des missions associées (pas de champ dédié)
    const contratConfirmed =
      match?.missionA?.briqueStatus === "CONFIRME" ||
      match?.missionB?.briqueStatus === "CONFIRME";
    return {
      mission:          s.swipedMission,
      affinityScore:    s.affinityScore,
      scoreDetails:     s.scoreDetails,
      matchId:          match?.id    ?? null,
      aiScore:          match?.aiScore ?? null,
      matchCreatedAt:   match?.createdAt ?? null,
      matchStatus:      match?.status ?? null,
      contratConfirmed: contratConfirmed ?? false,
    };
  });

  return NextResponse.json(result);
}
