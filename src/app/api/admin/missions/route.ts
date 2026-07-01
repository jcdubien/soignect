import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const missions = await prisma.mission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      location: true,
      missionType: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
      profile: { select: { id: true, name: true, type: true, user: { select: { email: true } } } },
    },
  });

  return NextResponse.json(missions);
}
