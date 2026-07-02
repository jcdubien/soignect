import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BriqueStatus, MissionType, ProfileType } from "@prisma/client";
import { getCommuneZonage } from "@/lib/communes";

export const dynamic = "force-dynamic";

const createMissionSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  location: z.string().min(1),
  specialties: z.array(z.string()).default([]),
  startDate: z.preprocess((v) => (v ? new Date(v as string) : null), z.date().optional().nullable()),
  endDate: z.preprocess((v) => (v ? new Date(v as string) : null), z.date().optional().nullable()),
  minMonths: z.number().int().min(1).max(24).optional().nullable(),
  pitch: z.string().max(280).optional().nullable(),
  bioTinder: z.string().max(280).optional().nullable(),
  retrocessionRate: z.number().int().min(0).max(100).optional().nullable(),
  missionType: z.nativeEnum(MissionType).optional(),
  dateFlexibility: z.number().int().min(0).max(4).optional(),
  briqueStatus: z.nativeEnum(BriqueStatus).optional(),
  cabinetPostId: z.string().optional().nullable(),
});

// GET /api/missions — feed de missions (type opposé, non encore swipées)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { id: session.user.profileId },
  });
  if (!myProfile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Missions déjà swipées par ce profil
  const swipedIds = await prisma.swipe.findMany({
    where: { swiperId: myProfile.id },
    select: { swipedMissionId: true },
  });
  const excludeMissionIds = swipedIds.map((s) => s.swipedMissionId);

  // Types de profils à afficher :
  // REMPLACANT & ASSISTANT voient les missions des TITULAIRES
  // TITULAIRE voit les missions des REMPLACANTS et ASSISTANTS
  const oppositeTypes =
    myProfile.type === ProfileType.TITULAIRE
      ? [ProfileType.REMPLACANT, ProfileType.ASSISTANT]
      : [ProfileType.TITULAIRE];

  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeMissionIds },
      profile: {
        type: { in: oppositeTypes },
        isActive: true,
        id: { not: myProfile.id },
      },
      ...(location ? { location } : {}),
    },
    include: {
      profile: true,
    },
    orderBy: [
      { profile: { weight: "desc" } },
      { profile: { ratingAvg: "desc" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  return NextResponse.json(missions);
}

// POST /api/missions — créer une mission
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createMissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, location, specialties, startDate, endDate, minMonths, pitch, bioTinder, retrocessionRate, missionType, dateFlexibility, briqueStatus, cabinetPostId } = parsed.data;

  // Validation 90 jours minimum pour les postes longs (section 37.E)
  const effectiveMissionType = missionType ?? MissionType.REMPLACEMENT;
  if (effectiveMissionType === MissionType.ASSISTANAT && startDate && endDate) {
    const dureeJours = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
    if (dureeJours < 90) {
      return NextResponse.json(
        { error: "Un poste d'assistanat ou CDD/CDI nécessite une durée minimale de 3 mois (90 jours)." },
        { status: 422 }
      );
    }
  }

  // Derive zonage from commune — only meaningful for ASSISTANAT/COLLABORATION
  const rawZonage = getCommuneZonage(location);
  const zonage = rawZonage === "INTERMEDIAIRE"
    ? "INTERMEDIAIRE"
    : rawZonage === "NON_PRIORITAIRE"
    ? "NON_PRIORITAIRE"
    : null;

  const mission = await prisma.mission.create({
    data: {
      profileId: session.user.profileId,
      title,
      description,
      location,
      specialties,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      minMonths,
      pitch: pitch ?? null,
      bioTinder: bioTinder ?? null,
      retrocessionRate: retrocessionRate ?? null,
      missionType: effectiveMissionType,
      zonage: zonage ? (zonage as import("@prisma/client").ZonageType) : null,
      dateFlexibility: dateFlexibility ?? 0,
      briqueStatus: briqueStatus ?? BriqueStatus.RECHERCHE,
      cabinetPostId: cabinetPostId ?? null,
    },
  });

  return NextResponse.json(mission, { status: 201 });
}
