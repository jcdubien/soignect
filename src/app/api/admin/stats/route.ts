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

  const [
    totalUsers,
    totalProfiles,
    totalActiveMissions,
    totalInactiveMissions,
    totalMatches,
    pendingRatings,
    profilesByType,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.mission.count({ where: { isActive: true } }),
    prisma.mission.count({ where: { isActive: false } }),
    prisma.match.count(),
    prisma.cabinetRating.count({ where: { isPublished: false } }),
    prisma.profile.groupBy({ by: ["type"], _count: { id: true } }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: { select: { name: true, type: true } },
      },
    }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalProfiles,
    totalActiveMissions,
    totalInactiveMissions,
    totalMatches,
    pendingRatings,
    profilesByType,
    recentUsers,
  });
}
