import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/deepseek";
import { MatchStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// PATCH /api/matches/[id] — met à jour le statut (item 12) OU recalcule le score IA
export async function PATCH(
  req: NextRequest,
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

  // Mise à jour du statut (item 12)
  const body = await req.json().catch(() => ({}));
  const status = (body as { status?: string }).status;
  if (status && (Object.values(MatchStatus) as string[]).includes(status)) {
    const updated = await prisma.match.update({ where: { id }, data: { status: status as MatchStatus } });
    return NextResponse.json({ status: updated.status });
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
