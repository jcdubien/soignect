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
      }))}
    />
  );
}
