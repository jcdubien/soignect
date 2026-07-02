import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const { isActive } = await req.json();

  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive requis" }, { status: 400 });
  }

  const updated = await prisma.mission.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true },
  });

  console.log(`[admin] mission ${id} isActive → ${isActive}`);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  await prisma.mission.delete({ where: { id } });

  console.log(`[admin] mission deleted: ${id}`);
  return NextResponse.json({ ok: true });
}
