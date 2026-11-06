import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Rattachement/détachement MANUEL d'un compte candidat (assistant, collaborateur) à un poste
// (section 153, point 2/3).
// Réservé au titulaire propriétaire du poste.

async function ownPost(id: string, profileId: string) {
  const post = await prisma.cabinetPost.findUnique({ where: { id }, select: { id: true, cabinetId: true } });
  if (!post) return { error: "Poste introuvable", status: 404 as const };
  if (post.cabinetId !== profileId) return { error: "Interdit", status: 403 as const };
  return { post };
}

// POST — rattacher un compte assistant (recherche par email) à ce poste.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const owned = await ownPost(id, session.user.profileId as string);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Email invalide" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
    select: { id: true, profile: { select: { type: true, name: true } } },
  });
  if (!user) return NextResponse.json({ error: "Aucun compte trouvé pour cet email." }, { status: 404 });
  // Même règle que le rattachement automatique (lib/assistantPost, section 201) : tout compte
  // CHERCHEUR de poste — REMPLACANT ou ASSISTANT. Le type décrit ce qu'on cherche, pas ce qu'on
  // devient ; et depuis la fusion des chercheurs (29/10) toute nouvelle inscription est
  // REMPLACANT : n'accepter qu'ASSISTANT refusait tous les comptes créés depuis (ROADMAP 49).
  // Un TITULAIRE reste refusé : rattaché ici, le propriétaire d'un autre cabinet deviendrait
  // l'occupant de ce poste.
  if (user.profile?.type !== "ASSISTANT" && user.profile?.type !== "REMPLACANT") {
    return NextResponse.json({ error: "Ce compte est celui d'un cabinet ou d'un établissement : il ne peut pas occuper un poste." }, { status: 422 });
  }

  // Unicité : détacher d'abord cet assistant d'un éventuel poste précédent.
  await prisma.cabinetPost.updateMany({ where: { linkedUserId: user.id }, data: { linkedUserId: null } });
  await prisma.cabinetPost.update({ where: { id }, data: { linkedUserId: user.id } });

  return NextResponse.json({ ok: true, linkedName: user.profile?.name ?? null });
}

// DELETE — détacher le compte assistant de ce poste (point 3, action manuelle).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const owned = await ownPost(id, session.user.profileId as string);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  await prisma.cabinetPost.update({ where: { id }, data: { linkedUserId: null } });
  return NextResponse.json({ ok: true });
}
