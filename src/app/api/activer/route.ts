import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { activerCompte } from "@/lib/confrereHorsSoignect";

export const dynamic = "force-dynamic";

// Activation d'un compte créé par un confrère (24/10) : la personne choisit son mot de passe et
// donne elle-même son consentement — sans elle, le compte ne sert qu'à porter la relation.
const schema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  email: z.string().trim().email("Email invalide").max(200),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères").max(200),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: "Acceptez les conditions pour activer votre compte." }) }),
  emailOptIn: z.boolean().optional(),
  // Sa partie du contrat (24/10) — relue et complétée par le confrère lui-même.
  rpps: z.string().trim().max(20).nullable().optional(),
  numeroOrdre: z.string().trim().max(30).nullable().optional(),
  adresse: z.string().trim().max(200).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Saisie invalide" }, { status: 400 });
  const r = await activerCompte(parsed.data.token, parsed.data.email, parsed.data.password, parsed.data.emailOptIn ?? false,
    { rpps: parsed.data.rpps, numeroOrdre: parsed.data.numeroOrdre, adresse: parsed.data.adresse });
  if (!r) return NextResponse.json({ error: "Lien invalide, expiré ou déjà utilisé." }, { status: 400 });
  if ("erreur" in r) return NextResponse.json({ error: r.erreur }, { status: 409 });
  return NextResponse.json({ email: r.email, matchId: r.matchId });
}
