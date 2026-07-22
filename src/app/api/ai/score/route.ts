import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/lib/deepseek";
import { checkDeepSeekBudget, recordDeepSeekCall } from "@/lib/deepseekBudget";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  missionAId: z.string(),
  missionBId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

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

  // Le scoring déclenche un appel DeepSeek payant (audit #4) : l'appelant doit être partie
  // prenante — propriétaire d'au moins une des deux missions comparées. Sinon, n'importe quel
  // compte pouvait scorer des paires arbitraires (abus de coût + sondage d'affinité de tiers).
  const myProfileId = session.user.profileId as string;
  if (missionA.profileId !== myProfileId && missionB.profileId !== myProfileId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Rate-limit DeepSeek (section 165) — repli neutre si plafond atteint.
  const budgetOk = await checkDeepSeekBudget(myProfileId);
  const result = await computeMatchScore(
    { profileType: missionA.profile.type, bio: missionA.profile.bio, ...missionA },
    { profileType: missionB.profile.type, bio: missionB.profile.bio, ...missionB },
    { skipDeepSeek: !budgetOk }
  );
  if (budgetOk) void recordDeepSeekCall(myProfileId);
  return NextResponse.json(result);
}
