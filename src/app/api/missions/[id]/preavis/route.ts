import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BriqueStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const schema = z.object({
  // Date de départ du préavis (défaut : aujourd'hui)
  preavisStart: z.string().optional(),
  // Durée du préavis en jours (3 mois ≈ 90, 1 mois ≈ 30, ou personnalisé)
  dureeJours: z.number().int().min(1).max(3650),
});

// POST /api/missions/[id]/preavis — poser un préavis sur une brique CONFIRME
// en durée indéterminée (section 57). Scinde la période :
//   CONFIRME (jusqu'au départ du préavis) → PREAVIS (durée du préavis) → NON_COUVERT (après).
// La zone NON_COUVERT est calculée automatiquement par la timeline (absence de mission
// couvrante après la fin du préavis).
export async function POST(
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

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const start = parsed.data.preavisStart ? new Date(parsed.data.preavisStart) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + parsed.data.dureeJours);

  // La brique CONFIRME s'arrête au départ du préavis
  await prisma.mission.update({
    where: { id },
    data: { endDate: start, statusUpdatedAt: new Date() },
  });

  // Nouvelle brique PREAVIS sur la durée du préavis
  const preavis = await prisma.mission.create({
    data: {
      profileId: mission.profileId,
      title: mission.title,
      location: mission.location,
      specialties: mission.specialties,
      missionType: mission.missionType,
      briqueStatus: BriqueStatus.PREAVIS,
      cabinetPostId: mission.cabinetPostId,
      startDate: start,
      endDate: end,
      isActive: false,
    },
  });

  return NextResponse.json({ confirmeUntil: start, preavis }, { status: 201 });
}
