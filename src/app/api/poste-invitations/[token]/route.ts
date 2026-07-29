import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Résout un token d'invitation poste (section 187) pour l'écran /register — pas d'auth
// (l'invité·e n'a pas encore de compte). Ne renvoie que du contexte non sensible (nom cabinet,
// intitulé du poste, email invité que le destinataire connaît déjà).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invitation = await prisma.posteInvitation.findUnique({ where: { token } });
  if (!invitation) return NextResponse.json({ valid: false, reason: "introuvable" });
  if (invitation.status !== "PENDING") return NextResponse.json({ valid: false, reason: "utilisée" });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ valid: false, reason: "expirée" });

  const post = await prisma.cabinetPost.findUnique({
    where: { id: invitation.cabinetPostId },
    select: { label: true, cabinet: { select: { name: true } } },
  });
  if (!post) return NextResponse.json({ valid: false, reason: "poste supprimé" });

  return NextResponse.json({
    valid: true,
    cabinetName: post.cabinet?.name ?? null,
    postLabel: post.label,
    invitedEmail: invitation.invitedEmail,
  });
}
