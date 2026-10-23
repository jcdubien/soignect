import { headers } from "next/headers";
import { logTraceEvent, logTraceEventAttendu } from "@/lib/trace";

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

/** Même repérage pour toute trace de visite publique (pages d'entrée, annonces) : un seul motif,
 *  sinon les compteurs cessent d'être comparables. */
export function estRobot(userAgent: string | null): boolean {
  return ROBOTS.test(userAgent ?? "");
}

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
        robot: estRobot(h.get("user-agent")),
        referent: domaine(h.get("referer")),
        annonces,
      },
    });
  } catch {
    // Une trace ne doit jamais empêcher la page de s'afficher.
  }
}

/** Ouverture de l'inscription (22/10) : la provenance (`src`, clé de la page d'entrée) et ce que
 *  le lien présélectionnait. Le visiteur n'est pas identifié — il n'a pas encore de compte. */
export async function tracerOuvertureInscription(o: { src: string | null; type: string | null; etablissement: boolean; profession: string | null }): Promise<void> {
  try {
    const h = await headers();
    // ATTENDUE, bornée à 1,5 s : cette page répond trop vite pour qu'une écriture lancée sans
    // attendre aboutisse sur Vercel (voir logTraceEventAttendu).
    await Promise.race([logTraceEventAttendu({
      eventType: "INSCRIPTION_OUVERTE",
      profession: o.profession?.slice(0, 40) ?? null,
      metadata: {
        src: o.src?.slice(0, 80) ?? "direct",
        type: o.type?.slice(0, 20) ?? null,
        etablissement: o.etablissement,
        robot: estRobot(h.get("user-agent")),
        referent: domaine(h.get("referer")),
      },
    }), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // Une trace ne doit jamais empêcher la page de s'afficher.
  }
}
