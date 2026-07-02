import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      profession: true,
      region: true,
      subscriptionPlan: true,
      isVerified: true,
      isFounding: true,
      isActive: true,
      desirabilityScore: true,
      desirabilityOverride: true,
      desirabilityExpiry: true,
      weight: true,
      createdAt: true,
      user: { select: { email: true } },
      _count: { select: { missions: { where: { isActive: true } } } },
    },
  });

  return NextResponse.json(profiles);
}
