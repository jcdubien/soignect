import { NextResponse } from "next/server";
import { DELAI_RELANCE_MS, inscritsSansPublication, envoyerRelances } from "@/lib/relancePublication";
import { surveillerJetonFacebook } from "@/lib/surveillanceJeton";

export const dynamic = "force-dynamic";

// GET /api/cron/publication-reminders — job QUOTIDIEN (Vercel Cron, 09h15).
//
// Relance unique des inscrits qui n'ont toujours rien publié 2 jours après leur inscription.
// Mêmes conventions que le cron des messages : protection par CRON_SECRET (en-tête Authorization
// ou ?key=), et marquage systématique des cibles traitées pour interdire tout second envoi.
//
// FRÉQUENCE QUOTIDIENNE, PAS PLUS. Un cron infra-journalier dans vercel.json bloque
// SILENCIEUSEMENT tous les builds sur le plan Hobby — la production a déjà gelé pour cette
// raison, sans le moindre message d'erreur.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authz = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    if (authz !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "Interdit" }, { status: 401 });
    }
  }

  // `?simulation=1` : compte sans envoyer ni marquer. Sert à vérifier ce que le job ferait avant
  // de le laisser tourner pour de bon.
  const simulation = new URL(req.url).searchParams.get("simulation") === "1";

  const cibles = await inscritsSansPublication(new Date(Date.now() - DELAI_RELANCE_MS));
  const r = await envoyerRelances(cibles, { simulation });

  // Surveillance de l'échéance du jeton Facebook (section 255), GREFFÉE ICI faute de pouvoir
  // ajouter une tâche : le plan Hobby en autorise deux, et les deux sont prises. Ce n'est pas le
  // sujet de ce job — d'où l'isolement du résultat sous sa propre clé, et une fonction qui ne
  // jette jamais : une surveillance qui tombe ne doit pas emporter les rappels avec elle.
  const jetonFacebook = await surveillerJetonFacebook({ simulation });

  return NextResponse.json({ ok: true, simulation, ...r, jetonFacebook });
}
