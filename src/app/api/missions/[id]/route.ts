import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  location: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  minMonths: z.number().int().min(1).max(24).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (mission.profileId !== session.user.profileId && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.mission.update({
    where: { id },
    data: {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : parsed.data.startDate,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : parsed.data.endDate,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (mission.profileId !== session.user.profileId && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  await prisma.mission.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
