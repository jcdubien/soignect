import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { genererEtStockerVignette } from "@/lib/vignetteStockage";

export const dynamic = "force-dynamic";
// Le rendu charge Satori puis sharp : il lui faut le runtime Node, et du temps. Sur Hobby le
// plafond est de 60 s ; une vignette coûte ~1,5 s, donc une par requête passe très largement.
export const maxDuration = 60;

// POST /api/admin/vignette — (re)génère la vignette de partage d'UNE annonce (section 285).
//
// POURQUOI UNE ROUTE ET PAS UN SCRIPT AUTONOME. Le rendu est du TypeScript avec du JSX et des
// alias `@/` : seul le build Next sait les résoudre. Un script Node qui réimplémenterait le
// chemin exécuterait une COPIE du code livré, et la copie finirait par diverger de l'original —
// exactement ce que ce dépôt paie ailleurs. Passer par la route garantit qu'on régénère avec le
// code qui sert en production.
//
// POURQUOI UNE ANNONCE PAR APPEL. Le rattrapage initial porte sur 61 vignettes à ~1,5 s ; tout
// faire dans une requête dépasserait le plafond de durée. Le script `scripts/rattrapage-vignettes.mjs`
// boucle donc côté client, ce qui le rend aussi REPRENABLE après interruption.
//
// Usage durable au-delà du rattrapage : régénérer après une évolution du visuel de la carte,
// ou réparer une annonce dont la génération avait échoué à la publication.
export async function POST(req: NextRequest) {
  // Deux portes, comme les crons : la clé d'infrastructure pour les scripts, la session
  // administrateur pour un geste humain depuis un navigateur.
  const secret = process.env.CRON_SECRET;
  const cle = req.headers.get("x-rattrapage-cle");
  let autorise = !!secret && cle === secret;
  if (!autorise) {
    const session = await auth();
    autorise = (session?.user as { role?: string })?.role === "ADMIN";
  }
  if (!autorise) return NextResponse.json({ error: "Interdit" }, { status: 401 });

  const { missionId } = await req.json().catch(() => ({ missionId: null }));
  if (typeof missionId !== "string" || !missionId) {
    return NextResponse.json({ error: "missionId requis" }, { status: 400 });
  }

  // `genererEtStockerVignette` ne lève jamais : son résultat typé porte déjà la distinction
  // entre « générée », « sans objet » (annonce retirée) et « échec », et le script s'en sert
  // pour compter sans avoir à interpréter un code HTTP.
  const resultat = await genererEtStockerVignette(missionId);
  return NextResponse.json(resultat);
}
