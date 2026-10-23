import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoRefuse, effacerLogo, erreurFichierLogo, stockerLogo } from "@/lib/logoClient";

export const dynamic = "force-dynamic";

// Logo d'une structure (23/10) — administration seulement. POST : dépôt (multipart, champ
// `file`) ; DELETE : retrait.

async function admin() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const { id } = await params;
  const client = await prisma.clientInstitutionnel.findUnique({ where: { id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Structure introuvable." }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  const err = erreurFichierLogo(file);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  let logoUrl: string;
  try {
    logoUrl = await stockerLogo(id, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof LogoRefuse) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[logo] dépôt impossible:", e);
    return NextResponse.json({ error: "Dépôt impossible pour le moment." }, { status: 500 });
  }
  await prisma.clientInstitutionnel.update({ where: { id }, data: { logoUrl } });
  return NextResponse.json({ ok: true, logoUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const { id } = await params;
  const client = await prisma.clientInstitutionnel.findUnique({ where: { id }, select: { logoUrl: true } });
  if (!client) return NextResponse.json({ error: "Structure introuvable." }, { status: 404 });
  if (client.logoUrl) await effacerLogo(id).catch((e) => console.error("[logo] retrait du fichier:", e));
  await prisma.clientInstitutionnel.update({ where: { id }, data: { logoUrl: null } });
  return NextResponse.json({ ok: true });
}
