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

// ── ÉTAT DU JETON (section 255) ──────────────────────────────────────────────────────────────
//
// LE DÉFAUT : l'expiration est SILENCIEUSE. Quand le jeton tombe, `publierSurLaPage` journalise
// un refus et rend la main — c'est la bonne conduite pour une publication en cours, mais personne
// ne lit les journaux d'une fonction qui n'échoue jamais bruyamment. La diffusion Facebook
// s'arrêterait donc un matin sans que rien ne le dise, et on le découvrirait en constatant
// l'absence de posts. Signalé le 06/09, resté ouvert deux semaines.
//
// CE QU'ON NE SAIT PAS ENCORE, ET QUE CE CODE VA DIRE. L'audit annonce « expire en novembre ».
// C'est à vérifier, pas à répéter : un jeton de Page dérivé d'un jeton utilisateur longue durée
// peut être PERMANENT — Graph renvoie alors `expires_at: 0`. Ce qui expire dans ce cas, c'est
// `data_access_expires_at`, fenêtre de 90 jours qui coupe l'accès aux données sans invalider le
// jeton. Les deux échéances n'appellent pas le même geste, et on ne peut pas les confondre.
//
// On n'interroge donc pas une supposition : on demande à Graph.

export interface EtatJeton {
  /** Le jeton est-il seulement configuré ? Faux en développement, ce n'est pas une panne. */
  configure: boolean;
  /** Graph a-t-il confirmé que le jeton est utilisable ? `null` = on n'a pas pu savoir. */
  valide: boolean | null;
  /** Échéance du jeton lui-même. `null` = permanent (ou inconnue, voir `motif`). */
  expireLe: string | null;
  /** Échéance de l'accès aux données — distincte, et souvent la vraie échéance. */
  accesDonneesExpireLe: string | null;
  /** Jours avant la PLUS PROCHE des deux échéances. `null` si aucune n'est connue. */
  joursRestants: number | null;
  /** Ce qui s'est passé, pour l'écran d'administration. Jamais montré à un utilisateur. */
  motif: string;
}

const JOUR_MS = 24 * 60 * 60 * 1000;
const joursAvant = (iso: string | null) =>
  iso ? Math.floor((new Date(iso).getTime() - Date.now()) / JOUR_MS) : null;

/**
 * Interroge Graph sur l'état du jeton de Page. NE JETTE JAMAIS.
 *
 * `debug_token` est le seul point d'accès qui donne une ÉCHÉANCE. Une simple publication d'essai
 * dirait « ça marche aujourd'hui » — ce qui est précisément l'information qui ne sert à rien ici :
 * on veut être prévenu AVANT la coupure, pas la constater.
 *
 * Repli si `debug_token` refuse (il attend parfois un jeton d'application) : on vérifie au moins
 * que le jeton répond, et on le dit sans prétendre connaître l'échéance. Une échéance inventée
 * serait pire que pas d'échéance du tout.
 */
export async function etatJetonPage(): Promise<EtatJeton> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const vide: EtatJeton = {
    configure: false, valide: null, expireLe: null,
    accesDonneesExpireLe: null, joursRestants: null, motif: "token-absent",
  };
  if (!token) return vide;

  try {
    const url = `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const json = (await res.json().catch(() => null)) as {
      data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number };
      error?: { message?: string; code?: number };
    } | null;

    if (res.ok && json?.data && typeof json.data.is_valid === "boolean") {
      // `0` signifie « n'expire pas » chez Graph — pas « expiré le 1er janvier 1970 ». Le
      // confondre afficherait une alarme permanente sur un jeton parfaitement sain.
      const ts = (v: number | undefined) => (v && v > 0 ? new Date(v * 1000).toISOString() : null);
      const expireLe = ts(json.data.expires_at);
      const accesLe = ts(json.data.data_access_expires_at);
      const jours = [joursAvant(expireLe), joursAvant(accesLe)].filter((j): j is number => j !== null);
      return {
        configure: true,
        valide: json.data.is_valid,
        expireLe,
        accesDonneesExpireLe: accesLe,
        joursRestants: jours.length ? Math.min(...jours) : null,
        motif: json.data.is_valid ? "ok" : "jeton-invalide",
      };
    }

    // Repli : Graph a refusé `debug_token`. On se contente de savoir si le jeton répond.
    const ping = await fetch(`${GRAPH}/${PAGE_ID}?fields=id&access_token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(6000),
    });
    const pingJson = (await ping.json().catch(() => null)) as { id?: string; error?: { code?: number } } | null;
    return {
      configure: true,
      valide: ping.ok && !!pingJson?.id,
      expireLe: null,
      accesDonneesExpireLe: null,
      joursRestants: null,
      motif: `debug_token-refuse-${json?.error?.code ?? res.status}`,
    };
  } catch (e) {
    return {
      configure: true, valide: null, expireLe: null, accesDonneesExpireLe: null,
      joursRestants: null, motif: `injoignable-${e instanceof Error ? e.name : "erreur"}`,
    };
  }
}

/** Seuils d'alerte, du plus lointain au plus proche. Chacun ne prévient QU'UNE FOIS — sans quoi
 *  un rappel quotidien pendant trente jours deviendrait un bruit qu'on apprend à ignorer, ce qui
 *  reproduirait exactement le silence qu'on corrige. */
export const SEUILS_ALERTE_JETON = [30, 14, 7, 3, 1] as const;

/**
 * Seuil le PLUS URGENT franchi par un nombre de jours restants, ou `null` si aucun.
 *
 * ATTENTION AU SENS DE LA RECHERCHE. Écrit d'abord `SEUILS.find((s) => jours <= s)` sur un
 * tableau décroissant, ce qui renvoyait **toujours 30** : à 2 jours de l'échéance, la fonction
 * annonçait le seuil 30, déjà signalé un mois plus tôt, et la déduplication éteignait alors les
 * alertes à 14, 7, 3 et 1 jour. Le dispositif se serait tu au moment précis où il devait crier —
 * la panne silencieuse qu'il est fait pour supprimer. Trouvé en testant les bornes une à une,
 * pas en relisant le code.
 *
 * On veut le plus PETIT seuil encore au-dessus des jours restants : à 10 jours, 14 et non 30.
 */
export function seuilFranchi(joursRestants: number | null): number | null {
  if (joursRestants === null) return null;
  const franchis = SEUILS_ALERTE_JETON.filter((s) => joursRestants <= s);
  return franchis.length ? Math.min(...franchis) : null;
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
