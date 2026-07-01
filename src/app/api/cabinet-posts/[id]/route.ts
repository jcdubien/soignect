import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const post = await prisma.cabinetPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (post.cabinetId !== session.user.profileId) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { isActive } = await req.json();
  if (typeof isActive !== "boolean") return NextResponse.json({ error: "isActive requis" }, { status: 400 });

  // Fermeture : cascade briqueStatus = ANNULE sur toutes les missions liées
  if (!isActive) {
    await prisma.mission.updateMany({
      where: { cabinetPostId: id },
      data: { briqueStatus: "ANNULE", statusUpdatedAt: new Date() },
    });
    console.log(`[cabinet-post] closed ${id} — missions cascaded to ANNULE`);
  }

  const updated = await prisma.cabinetPost.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true },
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

  const post = await prisma.cabinetPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (post.cabinetId !== session.user.profileId) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  await prisma.cabinetPost.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
