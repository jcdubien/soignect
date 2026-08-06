import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAffinityScore } from "@/lib/deepseek";
import { checkDeepSeekBudget, recordDeepSeekCall } from "@/lib/deepseekBudget";
import { logMatchCancelled } from "@/lib/trace";
import { MatchStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// PATCH /api/matches/[id] — met à jour le statut (item 12) OU recalcule le score IA
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const match = await prisma.match.findUnique({
    where: { id },
    include: { missionA: { include: { profile: true } }, missionB: { include: { profile: true } } },
  });

  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

  const { profileAId, profileBId } = match;
  if (session.user.profileId !== profileAId && session.user.profileId !== profileBId) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // Mise à jour du statut (item 12)
  const status = (body as { status?: string }).status;
  if (status && (Object.values(MatchStatus) as string[]).includes(status)) {
    // Une relation déclinée ou expirée s'arrête là : c'est une annulation, même sans
    // suppression. Tracée au même titre, pour que la fiabilité du marché se mesure sur tous
    // les abandons et pas seulement sur ceux qui effacent leurs traces.
    if (status === MatchStatus.DECLINE || status === MatchStatus.EXPIRE) {
      const viewerId = session.user.profileId as string;
      const acteur = viewerId === profileAId ? match.missionA?.profile : match.missionB?.profile;
      logMatchCancelled(match, {
        origine: "DECLINE",
        initiateur: status === MatchStatus.EXPIRE
          ? "SYSTEME"
          : acteur?.type === "TITULAIRE" ? "CABINET" : "CANDIDAT",
      });
    }
    const updated = await prisma.match.update({ where: { id }, data: { status: status as MatchStatus } });
    return NextResponse.json({ status: updated.status });
  }

  // Réaffectation de la mission cible côté utilisateur (item 10)
  const targetMissionId = (body as { targetMissionId?: string }).targetMissionId;
  if (targetMissionId) {
    const viewerId = session.user.profileId as string;
    // La nouvelle mission doit appartenir à l'utilisateur
    const mission = await prisma.mission.findUnique({
      where: { id: targetMissionId },
      select: { profileId: true },
    });
    if (!mission || mission.profileId !== viewerId) {
      return NextResponse.json({ error: "Mission invalide" }, { status: 400 });
    }
    // On met à jour le côté du match correspondant à l'utilisateur. Le score portait sur
    // l'ANCIEN couple d'annonces : le conserver le ferait passer pour l'évaluation du
    // nouveau. On le remet à « non calculé », charge à l'utilisateur de le relancer.
    const data = viewerId === profileAId ? { missionAId: targetMissionId } : { missionBId: targetMissionId };
    // Prisma.DbNull : mettre la colonne Json à NULL en base (null tout court y est refusé —
    // il désignerait la valeur JSON `null`, qui passerait pour un score enregistré).
    await prisma.match.update({ where: { id }, data: { ...data, aiScore: null, aiFactors: Prisma.DbNull } });
    return NextResponse.json({ ok: true, targetMissionId, rescoreNeeded: true });
  }

  // Calcul de la compatibilité du couple d'annonces. Déclencheur EXPLICITE : la branche
  // n'était atteignable qu'avec un corps de requête vide, que personne n'envoyait — les deux
  // appelants côté client postent toujours un status ou un targetMissionId. Le scoring était
  // donc du code mort, et un Match.aiScore à null le restait indéfiniment. Le corps vide reste
  // accepté pour ne rien casser.
  if (!match.missionA || !match.missionB) {
    return NextResponse.json({ error: "Missions manquantes pour le scoring" }, { status: 422 });
  }

  // Une seule formule dans toute l'application : celle du feed et des swipes. Le candidat est
  // le « swiper », l'annonce du cabinet la « mission » — c'est elle qui porte le type de poste,
  // donc le profil de pondération, et les bonus logement/véhicule.
  const [cabinetMission, candidatMission] =
    match.missionA.profile.type === "TITULAIRE"
      ? [match.missionA, match.missionB]
      : [match.missionB, match.missionA];

  const candidat = {
    bioTinder: candidatMission.bioTinder ?? candidatMission.profile.bioTinder,
    bio: candidatMission.profile.bio,
    specialties: candidatMission.specialties,
    startDate: candidatMission.startDate,
    endDate: candidatMission.endDate,
    minMonths: candidatMission.minMonths,
    location: candidatMission.location,
    zones: candidatMission.zones,
    dateFlexibility: candidatMission.profile.dateFlexibility,
    rechercheLogement: candidatMission.profile.rechercheLogement,
    rechercheVehicule: candidatMission.profile.rechercheVehicule,
    rechercheSecretariat: candidatMission.profile.rechercheSecretariat,
    rechercheExerciceCoordonne: candidatMission.profile.rechercheExerciceCoordonne,
  };
  const annonce = {
    bioTinder: cabinetMission.bioTinder ?? cabinetMission.profile.bioTinder,
    bio: cabinetMission.profile.bio,
    specialties: cabinetMission.specialties,
    startDate: cabinetMission.startDate,
    endDate: cabinetMission.endDate,
    minMonths: cabinetMission.minMonths,
    location: cabinetMission.location,
    zones: cabinetMission.zones,
    dateFlexibility: cabinetMission.dateFlexibility,
    missionType: cabinetMission.missionType,
    logementPropose: cabinetMission.logementPropose,
    vehiculePropose: cabinetMission.vehiculePropose,
    secretairePresente: cabinetMission.secretairePresente,
    exerciceCoordonne: cabinetMission.exerciceCoordonne,
  };

  // Rate-limit DeepSeek (section 165) — au-delà du plafond, seule la composante « profils »
  // retombe sur le neutre ; les dates et la géographie restent calculées.
  const budgetOk = await checkDeepSeekBudget(session.user.profileId as string);
  const result = await computeAffinityScore(candidat, annonce, { skipDeepSeek: !budgetOk });
  if (budgetOk) void recordDeepSeekCall(session.user.profileId as string);

  const updated = await prisma.match.update({
    where: { id },
    data: {
      aiScore: result.total,
      aiFactors: { ...result.details, profile: result.weightProfile } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ aiScore: updated.aiScore, aiFactors: updated.aiFactors, scored: true });
}
