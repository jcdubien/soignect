import { appBaseUrl } from "@/lib/appUrl";

// Publication sur la Page Facebook Soignect (section 234).
//
// LE JETON NE VIT QUE DANS L'ENVIRONNEMENT. `process.env.FACEBOOK_PAGE_ACCESS_TOKEN`, jamais en
// dur : c'est un jeton de Page à longue durée qui autorise à publier au nom de la marque. Écrit
// dans le dépôt, il partirait avec le premier `git clone`.
//
// AUCUNE IMAGE ENVOYÉE. On poste un LIEN, et Facebook va chercher lui-même la prévisualisation
// sur `/annonce/[id]`, qui porte déjà son bloc `openGraph` et son image générée (section 158).
// Envoyer une image séparée créerait une seconde source de vérité pour la même carte — celle du
// post et celle de la page divergeraient au premier changement de gabarit.
const PAGE_ID = "61593123871262";
const GRAPH = "https://graph.facebook.com/v21.0";

export interface ResultatPublicationFb {
  publie: boolean;
  /** Renseigné seulement en cas d'échec — sert aux journaux, jamais à l'utilisateur. */
  motif?: string;
  postId?: string;
}

/**
 * Publie un lien sur la Page. NE JETTE JAMAIS.
 *
 * La publication sur Soignect est déjà faite quand cette fonction s'exécute : un jeton expiré ou
 * un Facebook indisponible ne doit pas transformer une publication réussie en erreur à l'écran.
 * L'échec est journalisé et l'appelant continue — c'est la règle déjà appliquée aux emails et aux
 * notifications, qui sont eux aussi des canaux secondaires.
 */
export async function publierSurLaPage(opts: {
  message: string;
  cheminAnnonce: string;
}): Promise<ResultatPublicationFb> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) {
    // Absence de jeton = fonctionnalité non configurée, pas une panne. En développement c'est
    // l'état normal ; on le dit une fois, sans bruit d'erreur.
    console.warn("[facebook] FACEBOOK_PAGE_ACCESS_TOKEN absent — publication ignorée");
    return { publie: false, motif: "token-absent" };
  }

  const lien = `${appBaseUrl()}${opts.cheminAnnonce}`;

  try {
    // Délai borné : un Facebook lent ne doit pas retenir la réponse de notre propre route.
    const res = await fetch(`${GRAPH}/${PAGE_ID}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: opts.message, link: lien, access_token: token }),
      signal: AbortSignal.timeout(6000),
    });

    const data = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string; code?: number } } | null;

    if (!res.ok || data?.error) {
      // Le message d'erreur de Graph est journalisé tel quel : c'est lui qui distingue un jeton
      // expiré (code 190) d'une panne, et c'est cette distinction qui dira s'il faut agir.
      console.error(
        `[facebook] publication refusée (${res.status}) : ${data?.error?.message ?? "réponse illisible"}`,
      );
      return { publie: false, motif: `graph-${data?.error?.code ?? res.status}` };
    }

    return { publie: true, postId: data?.id };
  } catch (e) {
    console.error("[facebook] publication impossible :", e instanceof Error ? e.message : e);
    return { publie: false, motif: "reseau" };
  }
}

/** Texte du post. Volontairement sobre et factuel : la carte de prévisualisation porte déjà le
 *  titre, la commune et les dates — répéter tout ici produirait un post redondant. */
export function messagePourAnnonce(opts: {
  estCabinet: boolean;
  titre: string;
  commune: string;
}): string {
  return opts.estCabinet
    ? `Nouvelle offre en ${opts.commune} : ${opts.titre}`
    : `Disponibilité en ${opts.commune} : ${opts.titre}`;
}
