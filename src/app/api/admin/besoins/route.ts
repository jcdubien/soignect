import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITES_BESOIN } from "@/lib/besoinTerritoire";
import { deciderBesoin } from "@/lib/besoinTerritoireServeur";

export const dynamic = "force-dynamic";

// Validation des besoins du territoire (23/10) — la PREMIÈRE publication de chaque structure
// passe par l'administration (modération : besoin fantaisiste, doublon, coordonnées).

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const besoins = await prisma.besoinTerritoire.findMany({
    where: { statut: "A_VALIDER" }, orderBy: { updatedAt: "asc" },
    include: { client: { select: { nom: true, type: true } } },
  });
  return NextResponse.json({ besoins });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const d = z.object({ id: z.string(), decision: z.enum(["valider", "refuser"]), motif: z.string().trim().max(LIMITES_BESOIN.motifMax).nullish() })
    .safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
  const r = await deciderBesoin(d.data.id, d.data.decision, { id: session.user.id ?? null, nom: "Administration Soignect" }, d.data.motif ?? null);
  return r.ok ? NextResponse.json({ ok: true, besoin: r.besoin }) : NextResponse.json({ error: r.error }, { status: r.status });
}
