import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/deepseek";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  missionAId: z.string(),
  missionBId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [missionA, missionB] = await Promise.all([
    prisma.mission.findUnique({ where: { id: parsed.data.missionAId }, include: { profile: true } }),
    prisma.mission.findUnique({ where: { id: parsed.data.missionBId }, include: { profile: true } }),
  ]);

  if (!missionA || !missionB) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  const result = await computeMatchScore(
    { profileType: missionA.profile.type, bio: missionA.profile.bio, ...missionA },
    { profileType: missionB.profile.type, bio: missionB.profile.bio, ...missionB }
  );
  return NextResponse.json(result);
}
