import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess, isFreeAccessMode } from "@/lib/platform";
import { TitulaireMission } from "@/components/swipe/MissionSelector";
import AnnoncesClient from "./AnnoncesClient";

export const dynamic = "force-dynamic";

export default async function AnnoncesPage({ searchParams }: { searchParams: Promise<{ missionId?: string; disponibiliteId?: string }> }) {
  const session = await auth();
  const profileId   = (session?.user as { profileId?: string })?.profileId ?? null;
  const profileType = (session?.user as { profileType?: string })?.profileType ?? "REMPLACANT";
  const { missionId: initialMissionId, disponibiliteId } = await searchParams;

  // Statut Premium (item 8) — gating du bouton "Envoyer un contrat" dans le tray.
  // Prend en compte le mode lancement gratuit (section 2).
  let isPremium = false;
  if (profileId) {
    const me = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { subscriptionPlan: true, billingTriggeredAt: true },
    });
    isPremium = await hasPremiumAccess({ subscriptionPlan: me?.subscriptionPlan, billingTriggeredAt: me?.billingTriggeredAt });
  }

  // Mode lancement gratuit : masque toute communication « gratuit → payant » (section 2).
  const freeAccessMode = await isFreeAccessMode();

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
      isPremium={isPremium}
      freeAccessMode={freeAccessMode}
      titulaireMissions={titulaireMissions}
      initialMissionId={initialMissionId}
      disponibiliteId={disponibiliteId}
    />
  );
}
