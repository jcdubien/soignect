import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITES_VITRINE } from "@/lib/vitrineTerritoire";
import { deciderVitrine } from "@/lib/vitrineTerritoireServeur";

export const dynamic = "force-dynamic";

// Vitrines du territoire (02/11) — validation de la première publication, retrait d'une
// vitrine publiée. Motif obligatoire pour un refus ou un retrait.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const d = z.object({ id: z.string(), decision: z.enum(["valider", "refuser", "retirer"]), motif: z.string().trim().max(LIMITES_VITRINE.motifMax).nullish() })
    .safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
  const profil = session.user.id ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { name: true } }) : null;
  const auteur = { id: session.user.id ?? null, nom: `${profil?.name?.trim() || "Administration Soignect"} (administration)` };
  const r = await deciderVitrine(d.data.id, d.data.decision, auteur, d.data.motif ?? null);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
