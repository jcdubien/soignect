import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

  const body = await req.json();
  const { isActive, label } = body as { isActive?: unknown; label?: unknown };

  const data: { isActive?: boolean; label?: string } = {};

  // Renommage du poste (item 6 / section 65) — PATCH CabinetPost.label
  if (typeof label === "string") {
    const trimmed = label.trim();
    if (!trimmed) return NextResponse.json({ error: "Libellé vide" }, { status: 400 });
    data.label = trimmed.slice(0, 100);
  }

  if (typeof isActive === "boolean") {
    data.isActive = isActive;
    // Fermeture : cascade briqueStatus = ANNULE sur toutes les missions liées
    if (!isActive) {
      await prisma.mission.updateMany({
        where: { cabinetPostId: id },
        data: { briqueStatus: "ANNULE", statusUpdatedAt: new Date() },
      });
      console.log(`[cabinet-post] closed ${id} — missions cascaded to ANNULE`);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour (label ou isActive)" }, { status: 400 });
  }

  const updated = await prisma.cabinetPost.update({
    where: { id },
    data,
    select: { id: true, isActive: true, label: true },
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
