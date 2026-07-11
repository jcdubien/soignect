import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PlanningBoard from "./PlanningBoard";
import { logTraceEvent } from "@/lib/trace";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const session = await auth();
  if (!session?.user?.profileId) redirect("/login");

  const profileType = (session.user as { profileType?: string }).profileType;
  if (profileType !== "TITULAIRE") redirect("/annonces");

  const profileId = session.user.profileId as string;

  // Usage soutenu du Planning Board (section 100 critère 2) — trace fire-and-forget,
  // servira à compter les semaines d'activité distinctes.
  logTraceEvent({ eventType: "PLANNING_ACTIVE", profileId });

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { name: true, isEmployeur: true },
  });

  // Charger tous les postes + leurs missions actives + matchs associés
  const posts = await prisma.cabinetPost.findMany({
    where: { cabinetId: profileId },
    include: {
      missions: {
        include: {
          matchesA: {
            include: {
              profileB: { select: { id: true, name: true, type: true } },
              missionB: { select: { title: true, startDate: true, endDate: true } },
            },
          },
          matchesB: {
            include: {
              profileA: { select: { id: true, name: true, type: true } },
              missionA: { select: { title: true, startDate: true, endDate: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Récupérer les missions du cabinet non encore liées à un poste (hors absences)
  const unlinkedMissions = await prisma.mission.findMany({
    where: { profileId, cabinetPostId: null, isActive: true, isSelfPresence: false },
    select: { id: true, title: true, startDate: true, endDate: true, missionType: true },
  });

  // Récupérer les vacances déclarées du titulaire (isSelfPresence=true)
  const selfMissions = await prisma.mission.findMany({
    where: { profileId, isSelfPresence: true, isActive: true },
    include: {
      matchesA: {
        include: {
          profileB: { select: { id: true, name: true, type: true } },
          missionB: { select: { title: true, startDate: true, endDate: true } },
        },
      },
      matchesB: {
        include: {
          profileA: { select: { id: true, name: true, type: true } },
          missionA: { select: { title: true, startDate: true, endDate: true } },
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  return (
    <PlanningBoard
      posts={posts}
      profileId={profileId}
      cabinetName={profile?.name ?? "Mon cabinet"}
      isEmployeur={profile?.isEmployeur ?? false}
      unlinkedMissions={unlinkedMissions}
      selfMissions={selfMissions}
    />
  );
}
