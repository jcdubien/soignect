import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ matchId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;
  const { matchId } = await params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      profileA: { select: { id: true, name: true, subscriptionPlan: true } },
      profileB: { select: { id: true, name: true, subscriptionPlan: true } },
      missionA: { select: { missionType: true, retrocessionRate: true } },
      missionB: { select: { missionType: true, retrocessionRate: true } },
    },
  });

  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  if (match.profileAId !== profileId && match.profileBId !== profileId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const isA       = match.profileAId === profileId;
  const myProfile = isA ? match.profileA : match.profileB;
  const theirProfile = isA ? match.profileB : match.profileA;

  const plan = myProfile.subscriptionPlan as SubscriptionPlan;
  const hasPremium = plan === SubscriptionPlan.PREMIUM || plan === SubscriptionPlan.BOOST;

  const missionType =
    match.missionA?.missionType ?? match.missionB?.missionType ?? null;
  const retrocessionPct =
    match.missionA?.retrocessionRate ?? match.missionB?.retrocessionRate ?? 70;

  return NextResponse.json({
    missionType,
    theirName:       theirProfile.name,
    hasPremium,
    retrocessionPct,
  });
}
