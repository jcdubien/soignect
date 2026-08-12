import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma, SwipeDirection } from "@prisma/client";
import { computeAffinityScore } from "@/lib/deepseek";
import { checkDeepSeekBudget, recordDeepSeekCall } from "@/lib/deepseekBudget";
import { sendNewRelationEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { logTraceEvent } from "@/lib/trace";
import { bonusSaisonnier } from "@/lib/desirability";
import { pickBestPeriode } from "@/lib/periodes";

export const dynamic = "force-dynamic";

const swipeSchema = z.object({
  swipedMissionId: z.string(),
  direction:       z.nativeEnum(SwipeDirection),
  targetMissionId: z.string().optional(), // TITULAIRE's active chip mission
});

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
  // Période visée par le swipeur, conservée hors du bloc de scoring : la trace saisonnière en a
  // besoin plus bas, et la recalculer ferait un second appel à la base pour rien.
  let periodeSwipeur: { startDate: Date | null; endDate: Date | null } | null = null;
  let scoreDetails: object | undefined;

  if (direction === SwipeDirection.RIGHT) {
    // Le score compare l'annonce swipée à UNE de mes missions — encore faut-il que ce soit la
    // bonne. Le repli historique prenait findFirst({ isActive: true }), c'est-à-dire une mission
    // ARBITRAIRE (ordre d'insertion), pas celle qui sera appariée par le match quelques lignes
    // plus bas. Le score notait donc parfois un couple qui n'existait pas : constaté en prod,
    // deux lectures de la même paire à 25/25 et 6/25 en géographie selon le sens du swipe.
    // On applique ici le classement qui sert déjà à l'appariement — même règle, même résultat.
    const [swiperProfile, swiperMission] = await Promise.all([
      prisma.profile.findUnique({ where: { id: swiperId } }),
      targetMissionId
        ? prisma.mission.findUnique({ where: { id: targetMissionId } })
        : prisma.mission
            .findMany({ where: { profileId: swiperId, isActive: true }, orderBy: { createdAt: "desc" } })
            .then((mes) => pickBestPeriode(mes, (m) => m, swipedMission)),
    ]);

    if (swiperMission) periodeSwipeur = { startDate: swiperMission.startDate, endDate: swiperMission.endDate };

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
        // Demandes du swipeur (Profile) ET offres de sa propre annonce (Mission) : le scoreur lit
        // désormais chaque critère des deux côtés, pour que la paire ait UN score quel que soit
        // le sens du swipe (section 190). Un cabinet qui swipe une disponibilité apporte ici son
        // logement et son secrétariat, qu'il ne transmettait pas auparavant.
        rechercheLogement: swiperProfile.rechercheLogement,
        rechercheVehicule: swiperProfile.rechercheVehicule,
        rechercheSecretariat: swiperProfile.rechercheSecretariat,
        rechercheExerciceCoordonne: swiperProfile.rechercheExerciceCoordonne,
        missionType: swiperMission?.missionType,
        logementPropose: swiperMission?.logementPropose,
        vehiculePropose: swiperMission?.vehiculePropose,
        secretairePresente: swiperMission?.secretairePresente,
        exerciceCoordonne: swiperMission?.exerciceCoordonne,
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
        dateFlexibility: swipedMission.dateFlexibility,
        missionType: swipedMission.missionType,     // section 120 — profil de pondération
        // Offres de l'annonce swipée ET demandes du profil qui la porte — symétrique du bloc
        // ci-dessus. Une disponibilité de candidat n'a rien à « proposer », mais son profil
        // exprime les attentes qui décident quels bonus entrent au barème (section 190).
        logementPropose: swipedMission.logementPropose,
        vehiculePropose: swipedMission.vehiculePropose,
        secretairePresente: swipedMission.secretairePresente,
        exerciceCoordonne: swipedMission.exerciceCoordonne,
        rechercheLogement: missionProfile.rechercheLogement,
        rechercheVehicule: missionProfile.rechercheVehicule,
        rechercheSecretariat: missionProfile.rechercheSecretariat,
        rechercheExerciceCoordonne: missionProfile.rechercheExerciceCoordonne,
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
      // `saisonnier` : la carte retenue beneficiait-elle du bonus mai-octobre (section 197) ?
      // Compter les declenchements ne suffit pas — c'est la CONVERSION qui dira si remonter ces
      // profils produit des mises en relation, ou seulement du mouvement dans l'ordre.
      metadata: {
        ...(affinityScore !== undefined ? { affinityScore } : {}),
        saisonnier:
          bonusSaisonnier(
            { startDate: swipedMission.startDate, endDate: swipedMission.endDate },
            periodeSwipeur,
          ) > 0,
      },
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
    const reciprocalSwipe = pickBestPeriode(reciprocalSwipes, (s) => s.swipedMission, swipedMission);

    if (reciprocalSwipe) {
      const profileAId = swiperId < swipedMission.profileId ? swiperId : swipedMission.profileId;
      const profileBId = swiperId < swipedMission.profileId ? swipedMission.profileId : swiperId;

      const existing = await prisma.match.findUnique({
        where: { profileAId_profileBId: { profileAId, profileBId } },
      });

      if (!existing) {
        // Score du match = INSTANTANÉ du score de compatibilité au moment de la mise en
        // relation. Il n'existe plus de second calcul : le scoring dédié aux matchs était un
        // doublon LLM sans pondération, que l'interface contournait déjà et qui a rendu zéro
        // sur tout pendant des semaines sans que rien ne le signale. Une seule formule, celle
        // qui s'affiche partout — et qui vient d'être calculée quelques lignes plus haut pour
        // ce swipe même : on l'enregistre telle quelle, sans rappeler le modèle.
        const aiScore   = affinityScore;
        const aiFactors = scoreJson;

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
