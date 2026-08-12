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
  const { isActive, label, suiviNote } = body as { isActive?: unknown; label?: unknown; suiviNote?: unknown };

  const data: { isActive?: boolean; label?: string; suiviNote?: string | null; suiviUpdatedAt?: Date | null } = {};

  // Note de suivi du poste (section 200) — porte le suivi des ZONES NON COUVERTES, qui
  // n'existent comme aucun objet en base. Accepte null/vide pour effacer.
  if (suiviNote !== undefined) {
    if (suiviNote !== null && typeof suiviNote !== "string") {
      return NextResponse.json({ error: "suiviNote doit être une chaîne ou null" }, { status: 400 });
    }
    const t = typeof suiviNote === "string" ? suiviNote.trim() : "";
    // Coupe à 500 comme la colonne. Aligner la borne applicative sur la colonne évite le
    // P2000 déjà rencontré deux fois en production sur bioTinder/pitch (leçon Sentry).
    data.suiviNote = t ? t.slice(0, 500) : null;
    data.suiviUpdatedAt = t ? new Date() : null;
  }

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
    return NextResponse.json({ error: "Aucun champ à mettre à jour (label, isActive ou suiviNote)" }, { status: 400 });
  }

  const updated = await prisma.cabinetPost.update({
    where: { id },
    data,
    select: { id: true, isActive: true, label: true, suiviNote: true, suiviUpdatedAt: true },
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

  // Le siège du détenteur du compte (section 188) est sa propre ligne de planning : il n'a pas
  // de sens sans lui et ne se retire pas. Pour ne plus apparaître, il suffit de fermer ses
  // périodes — le siège vide signifie simplement « présent ».
  if (post.isOwnerSeat) {
    return NextResponse.json(
      { error: "Votre propre ligne de planning ne peut pas être supprimée." },
      { status: 409 }
    );
  }

  await prisma.cabinetPost.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
