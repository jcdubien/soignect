import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DisponibilitesBoard from "./DisponibilitesBoard";
import { ProfileType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DisponibilitesPage() {
  const session = await auth();
  if (!session?.user?.profileId) redirect("/login");

  const profileType = (session.user as { profileType?: string }).profileType;
  if (profileType === "TITULAIRE") redirect("/planning");

  const profileId = session.user.profileId as string;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      name: true,
      type: true,
      region: true,
    },
  });

  if (!profile) redirect("/login");

  // Missions du remplaçant/assistant — disponibilités + indisponibilités
  const missions = await prisma.mission.findMany({
    where: { profileId },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      minMonths: true, // durée minimale (vue assistant, section 179)
      briqueStatus: true,
      missionType: true,
      // Candidatures reçues (section 162) — mises en relation confirmées sur cette dispo.
      _count: { select: { matchesA: true, matchesB: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // « En attente » (section 162) : cabinets qui ont liké la dispo sans réciprocité encore
  // = swipes RIGHT reçus − confirmées. Un seul groupBy.
  const dispoIds = missions.map((m) => m.id);
  const rightSwipeGroups = dispoIds.length
    ? await prisma.swipe.groupBy({
        by: ["swipedMissionId"],
        where: { swipedMissionId: { in: dispoIds }, direction: "RIGHT" },
        _count: { _all: true },
      })
    : [];
  const likesByMission = new Map<string, number>();
  for (const g of rightSwipeGroups) likesByMission.set(g.swipedMissionId, g._count._all);

  // Match rattaché à chaque période (section 149) — pour le menu adaptatif : une période
  // « Confirmé » ouvre la fiche du match précis + l'annulation sécurisée, au lieu du modal
  // d'édition. On indexe par MA mission (côté disponibilité) → l'objet match exact.
  const myMatches = await prisma.match.findMany({
    where: { OR: [{ profileAId: profileId }, { profileBId: profileId }] },
    select: {
      id: true, profileAId: true, missionAId: true, missionBId: true,
      profileA: { select: { name: true } },
      profileB: { select: { name: true } },
    },
  });
  const matchByMission = new Map<string, { matchId: string; otherName: string | null }>();
  for (const mt of myMatches) {
    const isA = mt.profileAId === profileId;
    const myMissionId = isA ? mt.missionAId : mt.missionBId;
    const otherName = (isA ? mt.profileB : mt.profileA)?.name ?? null;
    if (myMissionId) matchByMission.set(myMissionId, { matchId: mt.id, otherName });
  }

  // Poste cabinet auquel ce compte ASSISTANT est rattaché (section 153, point 5) — double
  // casquette : afficher « Vous êtes assistant chez [cabinet] » + accès à sa propre couverture.
  const userId = session.user.id as string;
  const linkedPost = await prisma.cabinetPost.findFirst({
    where: { linkedUserId: userId },
    select: { id: true, label: true, postType: true, cabinet: { select: { name: true } } },
  });

  const regionLabel: Record<string, string> = {
    GUADELOUPE: "Pointe-à-Pitre", SAINT_MARTIN: "Saint-Martin", SAINT_BARTH: "Gustavia",
    MARTINIQUE: "Fort-de-France", GUYANE: "Cayenne", REUNION: "Saint-Denis",
    MAYOTTE: "Mamoudzou", METROPOLE: "France métropolitaine",
  };

  return (
    <DisponibilitesBoard
      profileName={profile.name}
      profileType={profile.type === ProfileType.ASSISTANT ? "ASSISTANT" : "REMPLACANT"}
      profileLocation={regionLabel[profile.region] ?? "Guadeloupe"}
      missions={missions.map(m => {
        const confirmed = m._count.matchesA + m._count.matchesB;
        const likes = likesByMission.get(m.id) ?? 0;
        return {
          id: m.id,
          title: m.title,
          startDate: m.startDate?.toISOString() ?? null,
          endDate: m.endDate?.toISOString() ?? null,
          minMonths: m.minMonths,
          briqueStatus: m.briqueStatus,
          missionType: m.missionType,
          matchId: matchByMission.get(m.id)?.matchId ?? null,
          matchOtherName: matchByMission.get(m.id)?.otherName ?? null,
          confirmedCount: confirmed,
          pendingCount: Math.max(0, likes - confirmed), // cabinets qui ont liké, sans réciprocité
        };
      })}
      linkedPost={linkedPost ? {
        id: linkedPost.id,
        label: linkedPost.label,
        cabinetName: linkedPost.cabinet?.name ?? null,
        isCollaboration: linkedPost.postType === "COLLABORATION" || linkedPost.postType === "ASSOCIE",
      } : null}
    />
  );
}
