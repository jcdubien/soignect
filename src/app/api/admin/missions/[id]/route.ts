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

  // Swipe.swipedMission et Match.missionA/B référencent Mission SANS onDelete (Restrict) :
  // un simple mission.delete échoue (500 silencieux) dès qu'une annonce a des swipes/matchs
  // — c'était la cause du bouton « Supprimer » inopérant. On purge les dépendances dans une
  // transaction, puis l'annonce. Le nombre de mises en relation retirées est remonté au client.
  try {
    const matches = await prisma.match.findMany({
      where: { OR: [{ missionAId: id }, { missionBId: id }] },
      select: { id: true },
    });
    const matchIds = matches.map((m) => m.id);

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { matchId: { in: matchIds } } }),
      prisma.cabinetRating.deleteMany({ where: { matchId: { in: matchIds } } }),
      prisma.remplacantRating.deleteMany({ where: { matchId: { in: matchIds } } }),
      prisma.rating.deleteMany({ where: { matchId: { in: matchIds } } }),
      prisma.match.deleteMany({ where: { id: { in: matchIds } } }),
      prisma.swipe.deleteMany({ where: { swipedMissionId: id } }),
      prisma.mission.delete({ where: { id } }),
    ]);

    console.log(`[admin] mission deleted: ${id} (+${matchIds.length} match(es))`);
    return NextResponse.json({ ok: true, deletedMatches: matchIds.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Suppression échouée";
    console.error(`[admin] mission delete failed: ${id}`, msg);
    return NextResponse.json({ error: `Suppression impossible : ${msg}` }, { status: 500 });
  }
}
