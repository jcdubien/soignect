import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileType, TitulaireKind, Prisma, BriqueStatus } from "@prisma/client";
import { stripMissionProfiles } from "@/lib/publicProfile";
import { NO_ACTIVE_MATCH_FILTER } from "@/lib/feedFilters";
import { getDesirabilityPercent } from "@/lib/desirability";

export const dynamic = "force-dynamic";

// GET /api/feed — annonces du camp opposé, ordonnées par mise en avant commerciale
// (désirabilité effective), puis note et fraîcheur. Cet ordre est le SEUL endroit où
// l'abonnement joue : il n'entre plus dans le score de compatibilité affiché.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { id: session.user.profileId as string },
  });
  if (!myProfile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const swipedIds = await prisma.swipe.findMany({
    where: { swiperId: myProfile.id },
    select: { swipedMissionId: true },
  });
  const excludeMissionIds = swipedIds.map((s) => s.swipedMissionId);

  const oppositeTypes =
    myProfile.type === ProfileType.TITULAIRE
      ? [ProfileType.REMPLACANT, ProfileType.ASSISTANT]
      : [ProfileType.TITULAIRE];

  const { searchParams } = new URL(req.url);
  const location        = searchParams.get("location");
  const limit           = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const targetMissionId = searchParams.get("targetMissionId");

  // When TITULAIRE selects a specific mission chip, filter candidats whose dates overlap
  let dateFilter: { startDate?: object; endDate?: object } = {};
  if (myProfile.type === ProfileType.TITULAIRE && targetMissionId) {
    const targetMission = await prisma.mission.findUnique({
      where: { id: targetMissionId },
      select: { startDate: true, endDate: true },
    });
    if (targetMission?.startDate && targetMission?.endDate) {
      dateFilter = {
        startDate: { lte: targetMission.endDate },
        endDate:   { gte: targetMission.startDate },
      };
    }
  }

  // Gating « ouverture au salariat » (section 154, opt-in) :
  //  - Candidat (REMPLACANT/ASSISTANT) NON opté → ne voit pas les missions des STRUCTURES
  //    (contrats salariés CDD/CDI/Stage/Vacation). Les cabinets libéraux restent visibles.
  //  - Viewer STRUCTURE → ne voit que les candidats ayant coché « ouvert au salariat ».
  //    (Un cabinet libéral titulaire, lui, voit tous les candidats — comportement inchangé.)
  const profileWhere: Prisma.ProfileWhereInput = {
    type: { in: oppositeTypes },
    isActive: true,
    id: { not: myProfile.id },
  };
  const isCandidateViewer = myProfile.type !== ProfileType.TITULAIRE;
  const isStructureViewer =
    myProfile.type === ProfileType.TITULAIRE && myProfile.titulaireKind === TitulaireKind.STRUCTURE;
  if (isCandidateViewer && !myProfile.ouvertSalariat) {
    profileWhere.titulaireKind = { not: TitulaireKind.STRUCTURE };
  }
  if (isStructureViewer) {
    profileWhere.ouvertSalariat = true;
  }

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      briqueStatus: { not: BriqueStatus.INDISPONIBLE }, // « Dates bloquées » = pas une offre
      // Les absences du titulaire (congés, présence) ne sont pas des offres non plus : elles
      // étaient pourtant swipables, un candidat s'est vu proposer une annonce « Congés ».
      // C'est aussi ce qui créait des Swipe sur une absence, bloquant ensuite sa suppression.
      isSelfPresence: false,
      id: { notIn: excludeMissionIds },
      ...NO_ACTIVE_MATCH_FILTER,
      profile: profileWhere,
      ...(location ? { location } : {}),
      ...dateFilter,
    },
    include: { profile: true },
    orderBy: [
      { profile: { ratingAvg: "desc" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  // Mise en avant commerciale — ELLE VIT ICI, dans l'ordre d'affichage, et nulle part ailleurs.
  // Elle sortait auparavant du score de compatibilité, où elle affirmait une chose fausse : le
  // statut d'abonnement de l'annonceur n'est pas une propriété de l'accord entre deux personnes.
  // Le tri SQL se faisait sur la colonne desirabilityScore brute, qui ignore le plan, le statut
  // fondateur et les arbitrages admin ; on trie donc sur la désirabilité EFFECTIVE, après
  // récupération de la page (au plus `limit` lignes, 50 max).
  const desirabilite = new Map<string, number>();
  for (const m of missions) desirabilite.set(m.id, getDesirabilityPercent(m.profile));
  missions.sort((a, b) => (desirabilite.get(b.id) ?? 0) - (desirabilite.get(a.id) ?? 0));

  // Nombre de candidats/annonces DISPONIBLES que l'utilisateur a DÉJÀ VUS (swipés) — mêmes
  // filtres que le feed (type, match actif, gating, zone/dates), mais uniquement les déjà-swipés.
  // Permet à l'UI de distinguer « aucun candidat n'existe » de « vous les avez déjà tous vus »
  // (l'état vide contredisait la réalité, section 1). Compté seulement si l'utilisateur a swipé.
  const seenAvailable = excludeMissionIds.length
    ? await prisma.mission.count({
        where: {
          isActive: true,
          briqueStatus: { not: BriqueStatus.INDISPONIBLE },
          id: { in: excludeMissionIds },
          ...NO_ACTIVE_MATCH_FILTER,
          profile: profileWhere,
          ...(location ? { location } : {}),
          ...dateFilter,
        },
      })
    : 0;

  // Expurge les champs sensibles du profil de chaque annonce (audit permissions, section 165) :
  // le feed ne doit exposer que les champs d'affichage (nom/photo/bio/région/note…).
  return NextResponse.json(stripMissionProfiles(missions), {
    headers: { "x-feed-seen-available": String(seenAvailable) },
  });
}
