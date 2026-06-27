import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileType } from "@prisma/client";
import SwipeDeck from "@/components/swipe/SwipeDeck";
import Link from "next/link";

export default async function SwipePage() {
  const session = await auth();
  const profileId = session!.user.profileId!;

  const myProfile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!myProfile) return null;

  // Missions déjà swipées
  const swipedIds = await prisma.swipe.findMany({
    where: { swiperId: profileId },
    select: { swipedMissionId: true },
  });
  const excludeIds = swipedIds.map((s) => s.swipedMissionId);

  const oppositeTypes =
    myProfile.type === ProfileType.TITULAIRE
      ? [ProfileType.REMPLACANT, ProfileType.ASSISTANT]
      : [ProfileType.TITULAIRE];

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeIds },
      profile: {
        type: { in: oppositeTypes },
        isActive: true,
        id: { not: profileId },
      },
    },
    include: { profile: true },
    orderBy: [{ profile: { weight: "desc" } }, { profile: { ratingAvg: "desc" } }, { createdAt: "desc" }],
    take: 10,
  });

  const myMissions = await prisma.mission.count({
    where: { profileId, isActive: true },
  });

  return (
    <div className="flex-1 flex flex-col max-w-sm mx-auto w-full" style={{ height: "calc(100vh - 60px)" }}>
      {/* Header contextuel */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            {myProfile.type === ProfileType.TITULAIRE ? "Remplaçants & Assistants" : "Missions disponibles"}
          </h2>
          <p className="text-xs text-gray-400">
            {missions.length} annonce{missions.length !== 1 ? "s" : ""} à découvrir
          </p>
        </div>
        <Link
          href="/missions/create"
          className="text-xs px-3 py-1.5 bg-kine-100 text-kine-700 rounded-lg font-medium hover:bg-kine-200 transition"
        >
          + Annonce
          {myMissions > 0 && (
            <span className="ml-1 text-kine-400">({myMissions})</span>
          )}
        </Link>
      </div>

      <div className="flex-1">
        <SwipeDeck initialMissions={[...missions].reverse()} />
      </div>
    </div>
  );
}
