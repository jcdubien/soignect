import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BriqueStatus, MissionType } from "@prisma/client";

const absenceSchema = z.object({
  absenceType: z.nativeEnum(BriqueStatus),
  title: z.string().min(1).max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;

  const body = await req.json();
  const parsed = absenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { absenceType, title, startDate, endDate } = parsed.data;

  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Dates invalides." }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { name: true },
  });

  const mission = await prisma.mission.create({
    data: {
      profileId,
      title,
      location: profile?.name ?? "cabinet",
      specialties: [],
      startDate: start,
      endDate:   end,
      missionType: MissionType.REMPLACEMENT,
      briqueStatus: absenceType,
      isSelfPresence: true,
    },
  });

  return NextResponse.json(mission, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;
  const { searchParams } = new URL(req.url);
  const missionId = searchParams.get("id");
  if (!missionId) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { profileId: true } });
  if (!mission || mission.profileId !== profileId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await prisma.mission.delete({ where: { id: missionId } });
  return NextResponse.json({ ok: true });
}
