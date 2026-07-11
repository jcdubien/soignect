import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// POST /api/profiles/[id]/photo — upload de la photo de profil côté serveur.
// L'upload passe par la clé service_role (bypass RLS) ; l'autorisation est
// gérée ici via NextAuth (propriétaire du profil ou ADMIN).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!profile) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (
    profile.userId !== session.user.id &&
    (session.user as { role?: string }).role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd (max 5 Mo)" }, { status: 400 });
  }
  const contentType = file.type || "image/jpeg";
  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: `Format non supporté : ${contentType}` }, { status: 400 });
  }

  // Emplacement : photo principale (défaut) ou secondaires 1/2 (section 3)
  const slot = String(form?.get("slot") ?? "main");
  const slotMap: Record<string, { suffix: string; field: "photoUrl" | "secondaryPhotoUrl1" | "secondaryPhotoUrl2" }> = {
    main:       { suffix: "",    field: "photoUrl" },
    secondary1: { suffix: "-s1", field: "secondaryPhotoUrl1" },
    secondary2: { suffix: "-s2", field: "secondaryPhotoUrl2" },
  };
  const target = slotMap[slot] ?? slotMap.main;

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${id}${target.suffix}.jpg`;

  const supabase = getSupabaseAdmin();
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType, upsert: true });
  if (upErr) {
    // Message réel de Supabase remonté au client
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  await prisma.profile.update({ where: { id }, data: { [target.field]: url } });

  return NextResponse.json({ url });
}

// DELETE /api/profiles/[id]/photo?slot=secondary1 — retire une photo secondaire (section 3)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { id }, select: { userId: true } });
  if (!profile) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (profile.userId !== session.user.id && (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const slot = new URL(req.url).searchParams.get("slot");
  const field = slot === "secondary1" ? "secondaryPhotoUrl1" : slot === "secondary2" ? "secondaryPhotoUrl2" : null;
  if (!field) return NextResponse.json({ error: "slot invalide" }, { status: 400 });

  await prisma.profile.update({ where: { id }, data: { [field]: null } });
  return NextResponse.json({ ok: true });
}
