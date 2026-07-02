import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileType } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/feed — annonces triées par desirabilityScore desc (nouveau feed Sprint 3)
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

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeMissionIds },
      profile: {
        type: { in: oppositeTypes },
        isActive: true,
        id: { not: myProfile.id },
      },
      ...(location ? { location } : {}),
      ...dateFilter,
    },
    include: { profile: true },
    orderBy: [
      { profile: { desirabilityScore: "desc" } },
      { profile: { ratingAvg: "desc" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  return NextResponse.json(missions);
}
