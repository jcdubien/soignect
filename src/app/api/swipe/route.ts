import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma, SwipeDirection } from "@prisma/client";
import { computeAffinityScore, computeMatchScore } from "@/lib/deepseek";
import { checkDeepSeekBudget, recordDeepSeekCall } from "@/lib/deepseekBudget";
import { sendNewRelationEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { logTraceEvent } from "@/lib/trace";

export const dynamic = "force-dynamic";

const swipeSchema = z.object({
  swipedMissionId: z.string(),
  direction:       z.nativeEnum(SwipeDirection),
  targetMissionId: z.string().optional(), // TITULAIRE's active chip mission
});

type Periode = { startDate: Date | null; endDate: Date | null };

// Recouvrement en jours entre deux périodes. null quand l'une des deux n'est pas bornée
// (annonce ouverte : « dès août », minMonths seul) : absence d'information, pas incompatibilité.
function overlapDays(a: Periode, b: Periode): number | null {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return null;
  const start = Math.max(a.startDate.getTime(), b.startDate.getTime());
  const end   = Math.min(a.endDate.getTime(),   b.endDate.getTime());
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

// Écart en jours entre deux périodes disjointes (0 si elles se touchent ou se recouvrent).
function gapDays(a: Periode, b: Periode): number {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return Number.MAX_SAFE_INTEGER;
  const ecart = a.startDate > b.endDate
    ? a.startDate.getTime() - b.endDate.getTime()
    : b.startDate.getTime() - a.endDate.getTime();
  return Math.max(0, Math.round(ecart / 86_400_000));
}

// Parmi les annonces que l'autre partie a retenues, celle qui correspond vraiment à la période
// visée, par ordre de préférence :
//   0. recouvrement réel — le plus large gagne ;
//   1. annonce non datée (« dès août », minMonths seul) : rien ne la contredit ;
//   2. dates disjointes mais annonce encore à venir ou en cours — l'écart le plus faible ;
//   3. annonce déjà passée : jamais retenue tant qu'il existe autre chose. Lier une nouvelle
//      mise en relation à une annonce périmée n'a aucun sens, or c'est exactement ce que
//      donnait le repli « la plus récemment swipée ».
// À égalité, la plus récente (liste triée par date décroissante, tri stable).
function pickBestReciprocal<T extends { swipedMission: Periode }>(
  swipes: T[],
  cible: Periode,
  maintenant: Date = new Date(),
): T | null {
  if (swipes.length === 0) return null;
  const classes = swipes.map((s) => {
    const o = overlapDays(s.swipedMission, cible);
    const perimee = !!s.swipedMission.endDate && s.swipedMission.endDate < maintenant;
    const rang = o === null ? 1 : o > 0 ? 0 : perimee ? 3 : 2;
    return { s, rang, recouvrement: o ?? 0, ecart: gapDays(s.swipedMission, cible) };
  });
  classes.sort((x, y) => x.rang - y.rang || y.recouvrement - x.recouvrement || x.ecart - y.ecart);
  return classes[0].s;
}

// Désirabilité en POURCENTAGE 0-100 (section 126). Appliquée ensuite proportionnellement
// au créneau Désirabilité du profil de pondération (10 pts Remplacement/Collab, 15 Assistanat).
function getDesirabilityPercent(profile: {
  isFounding: boolean;
  desirabilityOverride: number | null;
  desirabilityExpiry: Date | null;
  desirabilityScore: number;
  subscriptionPlan?: string;
  institutionalPartner?: boolean;
}): number {
  // Cabinet fondateur (JCD) = 100 % fixe.
  if (profile.isFounding) return 100;
  // Override admin = priorité absolue (0-100 %), tant que non expiré.
  if (profile.desirabilityOverride !== null) {
    const expired = profile.desirabilityExpiry && profile.desirabilityExpiry <= new Date();
    if (!expired) return Math.min(Math.max(profile.desirabilityOverride, 0), 100);
  }
  // Sinon dérivé du plan (automatique) : Premium 50, Boost 80, Structure 50, Gratuit 0.
  // Un desirabilityScore stocké (boost admin ponctuel) prime s'il est supérieur.
  const byPlan =
    profile.subscriptionPlan === "BOOST" ? 80 :
    (profile.subscriptionPlan === "PREMIUM" || profile.subscriptionPlan === "STRUCTURE") ? 50 : 0;
  const cpts = profile.institutionalPartner ? 20 : 0; // partenaire CPTS (section 23) — +20 %
  return Math.min(Math.max(byPlan, profile.desirabilityScore ?? 0) + cpts, 100);
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
        zones: swiperMission?.zones ?? [], // macro-zones souhaitées (section 138)
        dateFlexibility: swiperProfile.dateFlexibility,
        rechercheLogement: swiperProfile.rechercheLogement, // section 120
        rechercheVehicule: swiperProfile.rechercheVehicule, // feature terrain — bonus véhicule
      };
      const missionInput = {
        bioTinder: swipedMission.bioTinder,
        bio: missionProfile.bio,
        specialties: swipedMission.specialties,
        startDate: swipedMission.startDate,
        endDate: swipedMission.endDate,
        minMonths: swipedMission.minMonths,
        location: swipedMission.location,
        zones: swipedMission.zones, // macro-zones couvertes (section 138)
        desirabilityScore: getDesirabilityPercent(missionProfile),
        dateFlexibility: swipedMission.dateFlexibility,
        missionType: swipedMission.missionType,     // section 120 — profil de pondération
        logementPropose: swipedMission.logementPropose, // section 120 — bonus logement
        vehiculePropose: swipedMission.vehiculePropose, // feature terrain — bonus véhicule
      };
      try {
        // Rate-limit DeepSeek (section 165) : au-delà du plafond, on saute l'appel API et le
        // score bio retombe sur le neutre — le swipe s'enregistre quand même.
        const budgetOk = await checkDeepSeekBudget(swiperId);
        const result = await computeAffinityScore(swiperInput, missionInput, { skipDeepSeek: !budgetOk });
        affinityScore = result.total;
        // scoreDetails inclut désormais le détail logement + le profil de pondération utilisé (section 120)
        scoreDetails  = { ...result.details, profile: result.weightProfile };
        if (budgetOk) void recordDeepSeekCall(swiperId, swipedMission.missionType);
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

    // Une même personne peut avoir retenu PLUSIEURS de mes annonces. Prendre la première
    // venue (findFirst, sans tri) liait la mise en relation à une annonce dont la période
    // n'avait parfois rien à voir avec celle du candidat — constaté en prod : une dispo
    // 7 sept → 7 oct appariée à une annonce 14 déc → 17 janv, deux périodes disjointes.
    // Le match partait donc sur un malentendu de dates. On retient l'annonce qui recouvre
    // le mieux la période visée ; à défaut d'information de dates, la plus récente.
    const reciprocalSwipes = await prisma.swipe.findMany({
      where: {
        swiperId: swipedMission.profileId,
        ...reciprocalMissionFilter,
        direction: SwipeDirection.RIGHT,
      },
      include: { swipedMission: { select: { startDate: true, endDate: true } } },
      orderBy: { createdAt: "desc" },
    });
    const reciprocalSwipe = pickBestReciprocal(reciprocalSwipes, swipedMission);

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
            // Rate-limit DeepSeek (section 165) — au-delà du plafond, pas d'appel : le score
            // reste indéfini (colonne null), plutôt qu'un chiffre inventé qui ferait verdict.
            const budgetOk = await checkDeepSeekBudget(swiperId);
            const result = await computeMatchScore(
              { profileType: profileA.type, bio: profileA.bio, ...(missionA ?? {}) },
              { profileType: profileB.type, bio: profileB.bio, ...(missionB ?? {}) },
              { skipDeepSeek: !budgetOk }
            );
            if (result) {
              aiScore   = result.score;
              aiFactors = result.factors;
            }
            if (budgetOk) void recordDeepSeekCall(swiperId, swipedMission.missionType);
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
          select: { user: { select: { id: true, email: true, emailOptIn: true } } },
        });
        if (recipient?.user) {
          const actorType = (session.user as { profileType?: string }).profileType;
          const actorLabel = actorType === "TITULAIRE" ? "Un cabinet" : "Un remplaçant";
          // Notification in-app (section 155) — en parallèle de l'email.
          createNotification({
            userId: recipient.user.id,
            type: "match",
            message: `${actorLabel} a retenu votre profil — nouvelle mise en relation !`,
            linkUrl: `/matches?matchId=${match.id}`,
          });
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
