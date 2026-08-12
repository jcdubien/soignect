import { headers } from "next/headers";
import { logTraceEvent } from "@/lib/trace";

// Trace de fréquentation des pages d'entrée publiques (section 86).
//
// Extrait de la page guadeloupéenne au moment d'instrumenter ses deux sœurs : recopier vingt
// lignes trois fois aurait garanti qu'elles divergent — un jour on affine la détection de
// robots sur l'une, et les compteurs des trois cessent d'être comparables. Or la comparaison
// entre territoires est précisément ce qu'on cherche à mesurer.
//
// Aucune donnée personnelle : ni IP, ni identifiant. On compte des provenances, pas des
// personnes, et on conserve le DOMAINE référent seul — l'URL complète peut porter des
// paramètres privés.

// Robots connus. On ne les EXCLUT pas — savoir qu'on est indexé a de la valeur — on les
// ÉTIQUETTE, pour que le comptage humain reste lisible. Mesuré sur la page guadeloupéenne :
// 82 passages de robots pour 12 visites réelles. Sans la distinction, on aurait lu « 94 ».
const ROBOTS = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python-requests/i;

function domaine(referent: string | null): string | null {
  if (!referent) return null;
  try {
    return new URL(referent).hostname;
  } catch {
    return "invalide";
  }
}

// `page` = clé de regroupement, lue telle quelle par /admin/diffusion. La changer casserait
// l'historique de la page concernée : les anciens événements resteraient sous l'ancienne clé.
export async function tracerVueLanding(page: string, annonces: number): Promise<void> {
  try {
    const h = await headers();
    logTraceEvent({
      eventType: "LANDING_VIEW",
      metadata: {
        page,
        robot: ROBOTS.test(h.get("user-agent") ?? ""),
        referent: domaine(h.get("referer")),
        annonces,
      },
    });
  } catch {
    // Une trace ne doit jamais empêcher la page de s'afficher.
  }
}
