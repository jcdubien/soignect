import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { SwipeDirection } from "@prisma/client";
import { computeMatchScore } from "@/lib/deepseek";

const swipeSchema = z.object({
  swipedMissionId: z.string(),
  direction: z.nativeEnum(SwipeDirection),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = swipeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { swipedMissionId, direction } = parsed.data;
  const swiperId = session.user.profileId;

  // Vérifier que la mission existe et n'appartient pas au swipeur
  const swipedMission = await prisma.mission.findUnique({
    where: { id: swipedMissionId },
    include: { profile: true },
  });
  if (!swipedMission) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }
  if (swipedMission.profileId === swiperId) {
    return NextResponse.json({ error: "Impossible de swiper sa propre mission" }, { status: 400 });
  }

  await prisma.swipe.upsert({
    where: { swiperId_swipedMissionId: { swiperId, swipedMissionId } },
    create: { swiperId, swipedMissionId, direction },
    update: { direction },
  });

  let match = null;

  if (direction === SwipeDirection.RIGHT) {
    // Chercher si le propriétaire de la mission a swipé droite sur une de mes missions
    const myMissions = await prisma.mission.findMany({
      where: { profileId: swiperId, isActive: true },
      select: { id: true },
    });
    const myMissionIds = myMissions.map((m) => m.id);

    const reciprocalSwipe = await prisma.swipe.findFirst({
      where: {
        swiperId: swipedMission.profileId,
        swipedMissionId: { in: myMissionIds },
        direction: SwipeDirection.RIGHT,
      },
    });

    if (reciprocalSwipe) {
      const profileAId = swiperId < swipedMission.profileId ? swiperId : swipedMission.profileId;
      const profileBId = swiperId < swipedMission.profileId ? swipedMission.profileId : swiperId;

      const existing = await prisma.match.findUnique({
        where: { profileAId_profileBId: { profileAId, profileBId } },
      });

      if (!existing) {
        const [profileA, profileB] = await Promise.all([
          prisma.profile.findUnique({ where: { id: profileAId } }),
          prisma.profile.findUnique({ where: { id: profileBId } }),
        ]);

        let aiScore: number | undefined;
        let aiFactors: object | undefined;

        // Données enrichies avec la mission pour le scoring
        if (profileA && profileB) {
          const missionA = profileAId === swiperId
            ? await prisma.mission.findUnique({ where: { id: reciprocalSwipe.swipedMissionId } })
            : swipedMission;
          const missionB = profileAId === swiperId ? swipedMission
            : await prisma.mission.findUnique({ where: { id: reciprocalSwipe.swipedMissionId } });

          try {
            const result = await computeMatchScore(
              { profileType: profileA.type, bio: profileA.bio, ...(missionA ?? {}) },
              { profileType: profileB.type, bio: profileB.bio, ...(missionB ?? {}) }
            );
            aiScore = result.score;
            aiFactors = result.factors;
          } catch (err) {
            console.error("[DeepSeek] Erreur calcul score:", err);
          }
        }

        match = await prisma.match.create({
          data: {
            profileAId,
            profileBId,
            missionAId: profileAId === swiperId ? reciprocalSwipe.swipedMissionId : swipedMissionId,
            missionBId: profileAId === swiperId ? swipedMissionId : reciprocalSwipe.swipedMissionId,
            aiScore,
            aiFactors,
          },
          include: { profileA: true, profileB: true, missionA: true, missionB: true },
        });
      } else {
        match = existing;
      }
    }
  }

  return NextResponse.json({ swipe: { swiperId, swipedMissionId, direction }, match });
}
