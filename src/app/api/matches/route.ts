import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const profileId = session.user.profileId;

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ profileAId: profileId }, { profileBId: profileId }],
    },
    include: {
      profileA: true,
      profileB: true,
      missionA: true,
      missionB: true,
      ratings: {
        where: { raterId: profileId },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = matches.map((m) => {
    const isA = m.profileAId === profileId;
    return {
      id: m.id,
      aiScore: m.aiScore,
      aiFactors: m.aiFactors,
      createdAt: m.createdAt,
      hasRated: m.ratings.length > 0,
      otherProfile: isA ? m.profileB : m.profileA,
      myMission: isA ? m.missionA : m.missionB,
      theirMission: isA ? m.missionB : m.missionA,
    };
  });

  return NextResponse.json(formatted);
}
