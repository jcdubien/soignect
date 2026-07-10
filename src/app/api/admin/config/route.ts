import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

// Récupère (ou crée) le singleton PlatformConfig
async function getConfig() {
  const existing = await prisma.platformConfig.findFirst();
  if (existing) return existing;
  return prisma.platformConfig.create({ data: { freeAccessMode: true } });
}

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const cfg = await getConfig();
  const cabinetCount = await prisma.profile.count({ where: { type: "TITULAIRE" } });
  return NextResponse.json({ freeAccessMode: cfg.freeAccessMode, cabinetCount });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const { freeAccessMode } = await req.json();
  if (typeof freeAccessMode !== "boolean") {
    return NextResponse.json({ error: "freeAccessMode (boolean) requis" }, { status: 400 });
  }
  const cfg = await getConfig();
  const updated = await prisma.platformConfig.update({
    where: { id: cfg.id },
    data: { freeAccessMode },
    select: { freeAccessMode: true },
  });
  return NextResponse.json(updated);
}
