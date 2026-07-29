import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendPosteInvitationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Invitation par email à rejoindre Soignect pour se rattacher à ce poste (section 187).
// Réservé au titulaire propriétaire du poste (même garde que /link). Distinct de /link :
//  - /link      → rattache un compte ASSISTANT DÉJÀ EXISTANT (par email).
//  - /invite    → invite quelqu'un SANS compte (token + email), rattachement auto à l'inscription.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const post = await prisma.cabinetPost.findUnique({
    where: { id },
    select: { id: true, cabinetId: true, label: true, cabinet: { select: { name: true } } },
  });
  if (!post) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
  if (post.cabinetId !== session.user.profileId) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const parsed = z.object({ email: z.string().email() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  const email = parsed.data.email.toLowerCase().trim();

  // Pas de double mécanisme : si un compte existe déjà, renvoyer vers le rattachement manuel.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà pour cet email — utilisez « Rattacher un compte assistant »." },
      { status: 409 }
    );
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 jours

  await prisma.posteInvitation.create({
    data: { cabinetPostId: id, invitedEmail: email, token, expiresAt },
  });

  // Fire-and-forget : l'échec d'email ne doit pas faire échouer la création de l'invitation
  // (le lien reste utilisable ; l'email peut être renvoyé). sendEmail avale déjà ses erreurs.
  await sendPosteInvitationEmail(email, {
    cabinetName: post.cabinet?.name ?? null,
    postLabel: post.label,
    token,
  });

  return NextResponse.json({ ok: true });
}
