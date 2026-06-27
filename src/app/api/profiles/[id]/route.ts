import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  bio: z.string().max(300).optional(),
  photoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: { missions: { where: { isActive: true } } },
  });
  if (!profile) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  return NextResponse.json(profile);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (profile.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.profile.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}
