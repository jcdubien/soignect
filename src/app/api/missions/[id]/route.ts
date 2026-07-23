import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BriqueStatus, MissionType, ZoneGeographique } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/missions/[id] — données d'une annonce pour l'édition (propriétaire/admin)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({
    where: { id },
    select: {
      id: true, profileId: true, title: true, location: true, zones: true, specialties: true,
      startDate: true, endDate: true, minMonths: true, pitch: true,
      missionType: true, dateFlexibility: true, cabinetPostId: true,
    },
  });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (mission.profileId !== session.user.profileId && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  return NextResponse.json(mission);
}

const updateSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  location: z.string().optional(),
  zones: z.array(z.nativeEnum(ZoneGeographique)).optional(),
  specialties: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  minMonths: z.number().int().min(1).max(24).optional().nullable(),
  isActive: z.boolean().optional(),
  // Accroche éditable (section 179) — levier de matching de l'assistant. max large ici ; la
  // limite d'affichage (280 candidat) est portée par l'UI.
  bioTinder: z.string().max(700).optional().nullable(),
  // Édition complète d'annonce (section CRUD) — pitch, type, flexibilité
  pitch: z.string().max(280).optional().nullable(),
  missionType: z.nativeEnum(MissionType).optional(),
  dateFlexibility: z.number().int().min(0).max(4).optional(),
  briqueStatus: z.nativeEnum(BriqueStatus).optional(),
  statusNote: z.string().max(200).optional().nullable(),
  statusUpdatedAt: z.string().datetime().optional(),
  departureDate: z.string().datetime().optional().nullable(), // date de départ prévue (section 6)
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

  const { briqueStatus, statusNote, statusUpdatedAt, startDate, endDate, departureDate, ...rest } = parsed.data;

  const updated = await prisma.mission.update({
    where: { id },
    data: {
      ...rest,
      startDate: startDate ? new Date(startDate) : startDate,
      endDate: endDate ? new Date(endDate) : endDate,
      ...(departureDate !== undefined && { departureDate: departureDate ? new Date(departureDate) : null }),
      ...(briqueStatus !== undefined && {
        briqueStatus,
        statusNote: statusNote ?? null,
        statusUpdatedAt: statusUpdatedAt ? new Date(statusUpdatedAt) : new Date(),
      }),
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

  // Une période liée à un match CONFIRMÉ (contrat signé) ne se supprime pas ici : passer par
  // l'annulation de match dédiée (section 145/149) qui notifie l'autre partie et resync le poste.
  if (mission.briqueStatus === "CONFIRME") {
    return NextResponse.json(
      { error: "Cette période est liée à un contrat confirmé. Utilisez « Supprimer ce match » pour l'annuler." },
      { status: 409 }
    );
  }

  // Nettoyage des dépendances AVANT suppression, sinon les contraintes de clé étrangère
  // (Swipe.swipedMission, Match.missionA/B — sans onDelete cascade) font échouer le delete :
  // on retire les swipes reçus et les mises en relation non confirmées liées à cette annonce
  // (les Message des matchs supprimés partent en cascade au niveau base).
  await prisma.$transaction([
    prisma.swipe.deleteMany({ where: { swipedMissionId: id } }),
    prisma.match.deleteMany({ where: { OR: [{ missionAId: id }, { missionBId: id }] } }),
    prisma.mission.delete({ where: { id } }),
  ]);
  return NextResponse.json({ deleted: true });
}
