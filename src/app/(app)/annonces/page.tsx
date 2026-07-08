import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TitulaireMission } from "@/components/swipe/MissionSelector";
import AnnoncesClient from "./AnnoncesClient";

export const dynamic = "force-dynamic";

export default async function AnnoncesPage({ searchParams }: { searchParams: Promise<{ missionId?: string }> }) {
  const session = await auth();
  const profileId   = (session?.user as { profileId?: string })?.profileId ?? null;
  const profileType = (session?.user as { profileType?: string })?.profileType ?? "REMPLACANT";
  const { missionId: initialMissionId } = await searchParams;

  let titulaireMissions: TitulaireMission[] = [];

  if (profileType === "TITULAIRE" && profileId) {
    const missions = await prisma.mission.findMany({
      where: { profileId, isActive: true },
      select: {
        id: true,
        title: true,
        missionType: true,
        startDate: true,
        endDate: true,
        matchesA: { select: { id: true } },
        matchesB: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    titulaireMissions = missions.map(m => ({
      id: m.id,
      title: m.title,
      missionType: m.missionType as string,
      startDate:  m.startDate?.toISOString()  ?? null,
      endDate:    m.endDate?.toISOString()    ?? null,
      candidatesCount: m.matchesA.length + m.matchesB.length,
    }));
  }

  return (
    <AnnoncesClient
      profileType={profileType}
      profileId={profileId ?? ""}
      titulaireMissions={titulaireMissions}
      initialMissionId={initialMissionId}
    />
  );
}
