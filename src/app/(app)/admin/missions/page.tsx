import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import MissionsClient from "./MissionsClient";

export default async function AdminMissionsPage() {
  const missions = await prisma.mission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      location: true,
      missionType: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          name: true,
          type: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  return <MissionsClient initialMissions={JSON.parse(JSON.stringify(missions))} />;
}
