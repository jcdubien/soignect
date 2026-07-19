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
      briqueStatus: true,
      missionType: true,
    },
    orderBy: { startDate: "asc" },
  });

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
    select: { id: true, label: true, cabinet: { select: { name: true } } },
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
      missions={missions.map(m => ({
        id: m.id,
        title: m.title,
        startDate: m.startDate?.toISOString() ?? null,
        endDate: m.endDate?.toISOString() ?? null,
        briqueStatus: m.briqueStatus,
        missionType: m.missionType,
        matchId: matchByMission.get(m.id)?.matchId ?? null,
        matchOtherName: matchByMission.get(m.id)?.otherName ?? null,
      }))}
      linkedPost={linkedPost ? { id: linkedPost.id, label: linkedPost.label, cabinetName: linkedPost.cabinet?.name ?? null } : null}
    />
  );
}
