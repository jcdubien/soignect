import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { creerConfrereHorsSoignect, confreresAjoutes, LIMITES_CONFRERE } from "@/lib/confrereHorsSoignect";
import { COMMUNES_GUADELOUPE } from "@/lib/communes";

export const dynamic = "force-dynamic";

// Confrère trouvé hors Soignect (24/10) — voir lib/confrereHorsSoignect.
const L = LIMITES_CONFRERE;
const schema = z.object({
  prenom: z.string().trim().min(1, "Prénom requis").max(L.prenom),
  nom: z.string().trim().min(1, "Nom requis").max(L.nom),
  email: z.union([z.literal(""), z.string().trim().email("Email invalide").max(200)]).nullable().optional(),
  missionType: z.enum(["REMPLACEMENT", "ASSISTANAT", "COLLABORATION"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  minMonths: z.number().int().min(1).max(120).nullable().optional(),
  retrocessionRate: z.number().int().min(0).max(100),
  retrocessionMode: z.enum(["POURCENTAGE", "FIXE", "PLAFONNEE"]).nullable().optional(),
  retrocessionFixeEuros: z.number().int().min(1).max(100000).nullable().optional(),
  retrocessionPlafondEuros: z.number().int().min(1).max(100000).nullable().optional(),
  location: z.string().trim().min(1).max(120),
  rpps: z.string().trim().max(L.rpps).nullable().optional(),
  numeroOrdre: z.string().trim().max(L.numeroOrdre).nullable().optional(),
  adresse: z.string().trim().max(L.adresse).nullable().optional(),
}).superRefine((d, ctx) => {
  if (d.missionType === "REMPLACEMENT") {
    if (!d.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Date de fin requise pour un remplacement" });
    else if (d.endDate < d.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fin précède le début" });
  } else {
    if (!d.minMonths) ctx.addIssue({ code: "custom", path: ["minMonths"], message: "Durée minimale (mois) requise" });
    if (d.retrocessionMode === "FIXE" && !d.retrocessionFixeEuros) ctx.addIssue({ code: "custom", path: ["retrocessionFixeEuros"], message: "Montant mensuel de la redevance requis" });
    if (d.retrocessionMode === "PLAFONNEE" && !d.retrocessionPlafondEuros) ctx.addIssue({ code: "custom", path: ["retrocessionPlafondEuros"], message: "Plafond mensuel requis" });
  }
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ confreres: await confreresAjoutes(session.user.profileId) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Saisie invalide" }, { status: 400 });
  if (!(COMMUNES_GUADELOUPE as readonly string[]).includes(parsed.data.location)) return NextResponse.json({ error: "Commune inconnue" }, { status: 400 });
  const r = await creerConfrereHorsSoignect(session.user.profileId, { ...parsed.data, endDate: parsed.data.endDate ?? null, minMonths: parsed.data.minMonths ?? null });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ matchId: r.matchId, lien: r.lien });
}
