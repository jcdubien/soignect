import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/auth/check-email?email=xxx — disponibilité d'un email (item 21)
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ available: true });
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return NextResponse.json({ available: !existing });
}
