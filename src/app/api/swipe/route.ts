import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma, SwipeDirection } from "@prisma/client";
import { computeAffinityScore, computeMatchScore } from "@/lib/deepseek";
import { sendNewRelationEmail } from "@/lib/email";
import { logTraceEvent } from "@/lib/trace";

export const dynamic = "force-dynamic";

const swipeSchema = z.object({
  swipedMissionId: z.string(),
  direction:       z.nativeEnum(SwipeDirection),
  targetMissionId: z.string().optional(), // TITULAIRE's active chip mission
});

function getEffectiveDesirability(profile: {
  isFounding: boolean;
  desirabilityOverride: number | null;
  desirabilityExpiry: Date | null;
  desirabilityScore: number;
  institutionalPartner?: boolean;
}): number {
  if (profile.isFounding) return 10;
  // Boost +2 automatique pour les partenaires CPTS/institutionnels (section 23, item 24)
  const cptsBoost = profile.institutionalPartner ? 2 : 0;
  if (profile.desirabilityOverride !== null) {
    const expired = profile.desirabilityExpiry && profile.desirabilityExpiry <= new Date();
    if (!expired) return Math.min(profile.desirabilityOverride + cptsBoost, 10);
  }
  return Math.min(profile.desirabilityScore + cptsBoost, 10);
}

// DELETE /api/swipe?missionId=… — annule un swipe (section 98) : la mission
// redevient visible dans le feed (le feed exclut les missions déjà swipées).
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const missionId = searchParams.get("missionId");
  if (!missionId) {
    return NextResponse.json({ error: "missionId requis" }, { status: 400 });
  }
  const swiperId = session.user.profileId as string;
  await prisma.swipe.deleteMany({ where: { swiperId, swipedMissionId: missionId } });
  return NextResponse.json({ ok: true });
}

// POST /api/swipe — swipe avec calcul affinityScore (0-100) stocké sur la ligne Swipe
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

  const { swipedMissionId, direction, targetMissionId } = parsed.data;
  const swiperId = session.user.profileId as string;

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

  let affinityScore: number | undefined;
  let scoreDetails: object | undefined;

  if (direction === SwipeDirection.RIGHT) {
    const [swiperProfile, swiperMission] = await Promise.all([
      prisma.profile.findUnique({ where: { id: swiperId } }),
      targetMissionId
        ? prisma.mission.findUnique({ where: { id: targetMissionId } })
        : prisma.mission.findFirst({ where: { profileId: swiperId, isActive: true } }),
    ]);

    if (swiperProfile) {
      const missionProfile = swipedMission.profile;
      const swiperInput = {
        bioTinder: swiperProfile.bioTinder,
        bio: swiperProfile.bio,
        specialties: swiperMission?.specialties ?? [],
        startDate: swiperMission?.startDate,
        endDate: swiperMission?.endDate,
        minMonths: swiperMission?.minMonths,
        location: swiperMission?.location ?? swipedMission.location,
        dateFlexibility: swiperProfile.dateFlexibility,
      };
      const missionInput = {
        bioTinder: swipedMission.bioTinder,
        bio: missionProfile.bio,
        specialties: swipedMission.specialties,
        startDate: swipedMission.startDate,
        endDate: swipedMission.endDate,
        minMonths: swipedMission.minMonths,
        location: swipedMission.location,
        desirabilityScore: getEffectiveDesirability(missionProfile),
        dateFlexibility: swipedMission.dateFlexibility,
      };
      try {
        const result = await computeAffinityScore(swiperInput, missionInput);
        affinityScore = result.total;
        scoreDetails  = result.details;
      } catch (err) {
        console.error("[AffinityScore] Erreur:", err);
      }
    }
  }

  const scoreJson = scoreDetails !== undefined
    ? (scoreDetails as Prisma.InputJsonValue)
    : undefined;

  const swipe = await prisma.swipe.upsert({
    where: { swiperId_swipedMissionId: { swiperId, swipedMissionId } },
    create: { swiperId, swipedMissionId, direction, affinityScore, scoreDetails: scoreJson },
    update: { direction, affinityScore, scoreDetails: scoreJson },
  });

  let match = null;

  if (direction === SwipeDirection.RIGHT) {
    // Traçabilité (section 86) — fire-and-forget
    logTraceEvent({
      eventType: "SWIPE_RIGHT",
      missionId: swipedMissionId,
      commune: swipedMission.location,
      missionType: swipedMission.missionType,
      metadata: affinityScore !== undefined ? { affinityScore } : undefined,
    });

    let reciprocalMissionFilter: { swipedMissionId: string | { in: string[] } };

    if (targetMissionId) {
      // Précis : le candidat a-t-il swipé exactement la mission sélectionnée ?
      reciprocalMissionFilter = { swipedMissionId: targetMissionId };
    } else {
      const myMissions = await prisma.mission.findMany({
        where: { profileId: swiperId, isActive: true },
        select: { id: true },
      });
      reciprocalMissionFilter = { swipedMissionId: { in: myMissions.map((m) => m.id) } };
    }

    const reciprocalSwipe = await prisma.swipe.findFirst({
      where: {
        swiperId: swipedMission.profileId,
        ...reciprocalMissionFilter,
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

        if (profileA && profileB) {
          const missionA = profileAId === swiperId
            ? await prisma.mission.findUnique({ where: { id: reciprocalSwipe.swipedMissionId } })
            : swipedMission;
          const missionB = profileAId === swiperId
            ? swipedMission
            : await prisma.mission.findUnique({ where: { id: reciprocalSwipe.swipedMissionId } });

          try {
            const result = await computeMatchScore(
              { profileType: profileA.type, bio: profileA.bio, ...(missionA ?? {}) },
              { profileType: profileB.type, bio: profileB.bio, ...(missionB ?? {}) }
            );
            aiScore   = result.score;
            aiFactors = result.factors;
          } catch (err) {
            console.error("[DeepSeek] Erreur calcul score match:", err);
          }
        }

        // missionAId = TITULAIRE's mission, missionBId = candidat's mission
        const mySideMissionId = targetMissionId ?? reciprocalSwipe.swipedMissionId;

        match = await prisma.match.create({
          data: {
            profileAId,
            profileBId,
            missionAId: profileAId === swiperId ? mySideMissionId : swipedMissionId,
            missionBId: profileAId === swiperId ? swipedMissionId : mySideMissionId,
            aiScore,
            aiFactors,
          },
          include: { profileA: true, profileB: true, missionA: true, missionB: true },
        });

        // Traçabilité (section 86) — match créé, fire-and-forget
        logTraceEvent({
          eventType: "MATCH_CREATED",
          matchId: match.id,
          missionId: swipedMissionId,
          commune: swipedMission.location,
          missionType: swipedMission.missionType,
        });

        // Email "nouvelle mise en relation" à l'autre partie (fire-and-forget)
        const recipient = await prisma.profile.findUnique({
          where: { id: swipedMission.profileId },
          select: { user: { select: { email: true, emailOptIn: true } } },
        });
        if (recipient?.user) {
          const actorType = (session.user as { profileType?: string }).profileType;
          const actorLabel = actorType === "TITULAIRE" ? "Un cabinet" : "Un remplaçant";
          await sendNewRelationEmail(recipient.user.email, {
            actorLabel,
            optIn: recipient.user.emailOptIn,
          });
        }
      } else {
        match = existing;
      }
    }
  }

  return NextResponse.json({ swipe, match, affinityScore: affinityScore ?? null });
}
