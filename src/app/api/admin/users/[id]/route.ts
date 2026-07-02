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
  const body = await req.json();

  if (!["ADMIN", "USER"].includes(body.role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: { id: true, email: true, role: true },
  });

  console.log(`[admin] role: ${id} → ${body.role}`);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  await prisma.user.delete({ where: { id } });

  console.log(`[admin] user deleted: ${id}`);
  return NextResponse.json({ ok: true });
}
