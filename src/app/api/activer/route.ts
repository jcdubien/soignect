import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { activerCompte } from "@/lib/confrereHorsSoignect";

export const dynamic = "force-dynamic";

// Activation d'un compte créé par un confrère (24/10) : la personne choisit son mot de passe et
// donne elle-même son consentement — sans elle, le compte ne sert qu'à porter la relation.
const schema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères").max(200),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: "Acceptez les conditions pour activer votre compte." }) }),
  emailOptIn: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Saisie invalide" }, { status: 400 });
  const r = await activerCompte(parsed.data.token, parsed.data.password, parsed.data.emailOptIn ?? false);
  if (!r) return NextResponse.json({ error: "Lien invalide, expiré ou déjà utilisé." }, { status: 400 });
  return NextResponse.json({ email: r.email, matchId: r.matchId });
}
