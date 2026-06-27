import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/deepseek";

// PATCH /api/matches/[id] — recalcule le score IA d'un match existant
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const match = await prisma.match.findUnique({
    where: { id },
    include: { missionA: { include: { profile: true } }, missionB: { include: { profile: true } } },
  });

  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

  const { profileAId, profileBId } = match;
  if (session.user.profileId !== profileAId && session.user.profileId !== profileBId) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  if (!match.missionA || !match.missionB) {
    return NextResponse.json({ error: "Missions manquantes pour le scoring" }, { status: 422 });
  }

  const result = await computeMatchScore(
    { profileType: match.missionA.profile.type, bio: match.missionA.profile.bio, ...match.missionA },
    { profileType: match.missionB.profile.type, bio: match.missionB.profile.bio, ...match.missionB }
  );

  const updated = await prisma.match.update({
    where: { id },
    data: { aiScore: result.score, aiFactors: result.factors },
  });

  return NextResponse.json({ aiScore: updated.aiScore, aiFactors: updated.aiFactors });
}
