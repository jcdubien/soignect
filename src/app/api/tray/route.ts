import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/tray — swipes RIGHT triés par affinityScore desc (meilleur match en premier).
// Filtre optionnel ?disponibiliteId= (section 7) : ne garde que les mises en relation
// rattachées à CETTE disponibilité du remplaçant.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const swiperId = session.user.profileId as string;
  const disponibiliteId = new URL(req.url).searchParams.get("disponibiliteId");

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
      id: true, profileAId: true, profileBId: true,
      missionAId: true, missionBId: true, aiScore: true, createdAt: true, status: true,
      missionA: { select: { briqueStatus: true } },
      missionB: { select: { briqueStatus: true } },
    },
  });

  // Mission propre du remplaçant dans un match donné (= sa disponibilité)
  const ownMissionId = (m: { profileAId: string; missionAId: string | null; missionBId: string | null }) =>
    m.profileAId === swiperId ? m.missionAId : m.missionBId;

  const resultAll = swipes.map((s) => {
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

  // Filtre disponibilité (section 7) : uniquement les mises en relation de cette dispo
  const result = disponibiliteId
    ? resultAll.filter((item) => {
        if (!item.matchId) return false;
        const m = matches.find((mm) => mm.id === item.matchId);
        return m ? ownMissionId(m) === disponibiliteId : false;
      })
    : resultAll;

  return NextResponse.json(result);
}
