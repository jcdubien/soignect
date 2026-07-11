import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { SubscriptionPlan } from "@prisma/client";

export const dynamic = "force-dynamic";

const schema = z.object({
  profileId: z.string().min(1),
  desirabilityOverride: z.number().min(0).max(10).nullable(),
  desirabilityExpiry: z.string().datetime().nullable().optional(),
});

function computeScore(opts: {
  isFounding: boolean;
  override: number | null;
  expiry: Date | null;
  plan: SubscriptionPlan;
}): number {
  if (opts.isFounding) return 10;
  if (opts.override !== null) {
    const expired = opts.expiry && opts.expiry <= new Date();
    if (!expired) return opts.override;
  }
  return ({ FREE: 0, PREMIUM: 5, BOOST: 8, STRUCTURE: 8 } as Record<SubscriptionPlan, number>)[opts.plan] ?? 0;
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { profileId, desirabilityOverride, desirabilityExpiry } = parsed.data;

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  if (profile.isFounding && desirabilityOverride !== null && desirabilityOverride < 10) {
    return NextResponse.json({ error: "Cabinet fondateur : score minimum 10" }, { status: 400 });
  }

  const expiryDate = desirabilityExpiry ? new Date(desirabilityExpiry) : null;

  const newScore = computeScore({
    isFounding: profile.isFounding,
    override: desirabilityOverride,
    expiry: expiryDate,
    plan: profile.subscriptionPlan,
  });

  const result = await prisma.profile.update({
    where: { id: profileId },
    data: { desirabilityOverride, desirabilityExpiry: expiryDate, desirabilityScore: newScore },
  });

  return NextResponse.json({ desirabilityScore: result.desirabilityScore });
}
