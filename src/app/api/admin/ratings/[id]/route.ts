import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;

  const updated = await prisma.cabinetRating.update({
    where: { id },
    data: { isPublished: true },
    select: { id: true, isPublished: true },
  });

  console.log(`[admin] rating published: ${id}`);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  await prisma.cabinetRating.delete({ where: { id } });

  console.log(`[admin] rating rejected/deleted: ${id}`);
  return NextResponse.json({ ok: true });
}
