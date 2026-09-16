// Brouillon de formulaire conservé dans le navigateur (section 252).
//
// ── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ──────────────────────────────────────────────
//
// Il porte le MÉCANISME — écrire, relire, dater, effacer — et rien de la POLITIQUE : quand
// enregistrer, quoi enregistrer, quand proposer la reprise. Ces choix-là diffèrent d'un écran à
// l'autre et restent sur place.
//
// Le formulaire cabinet a son propre brouillon depuis longtemps (`missionDraft`), écrit à UN seul
// moment : juste avant le détour « ajoutez une photo ». Il ne survit pas à une sortie ordinaire,
// et n'a jamais eu à le faire. Le formulaire candidat a le besoin inverse — voir plus bas, dans
// l'écran lui-même. Deux politiques différentes, donc, sur un seul mécanisme ; le cabinet garde
// aujourd'hui sa copie inline, qu'il pourra reverser ici sans rien changer à son comportement.
//
// ── POURQUOI UNE DATE DE PÉREMPTION ──────────────────────────────────────────────────────────
//
// Un brouillon de recherche contient des DATES de disponibilité. Restauré trois semaines plus
// tard, il repropose une période déjà écoulée — exactement le piège contre lequel le formulaire
// affiche désormais un avertissement (section 250). Passé le délai, on préfère un formulaire vide
// à une saisie qui rouvre le défaut qu'on vient de fermer.

/** Au-delà, un brouillon est jeté sans être proposé. Sept jours : au-delà d'une semaine, les
 *  dates saisies ont cessé d'être celles qu'on voulait annoncer. */
export const PEREMPTION_BROUILLON_MS = 7 * 24 * 60 * 60 * 1000;

interface Enveloppe<T> {
  /** Horodatage d'écriture — c'est lui, et non le contenu, qui décide de la péremption. */
  at: number;
  v: T;
}

/**
 * Relit un brouillon non périmé, ou `null`.
 *
 * NE JETTE JAMAIS : `localStorage` est indisponible en navigation privée sur certains mobiles, et
 * un brouillon illisible ne doit jamais empêcher l'écran de s'ouvrir. Un contenu corrompu est
 * effacé au passage plutôt que relu à chaque visite.
 */
export function lireBrouillon<T>(cle: string, peremptionMs = PEREMPTION_BROUILLON_MS): T | null {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return null;
    const env = JSON.parse(brut) as Enveloppe<T> | null;
    if (!env || typeof env.at !== "number" || env.v == null) {
      localStorage.removeItem(cle);
      return null;
    }
    if (Date.now() - env.at > peremptionMs) {
      localStorage.removeItem(cle);
      return null;
    }
    return env.v;
  } catch {
    return null;
  }
}

/** Écrit un brouillon daté. Ne jette jamais : quota plein ou stockage refusé, la saisie en cours
 *  reste valable à l'écran — seule la reprise après sortie est perdue. */
export function ecrireBrouillon<T>(cle: string, valeur: T): void {
  try {
    localStorage.setItem(cle, JSON.stringify({ at: Date.now(), v: valeur } satisfies Enveloppe<T>));
  } catch {
    /* voir plus haut */
  }
}

/** Efface un brouillon. Ne jette jamais. */
export function effacerBrouillon(cle: string): void {
  try {
    localStorage.removeItem(cle);
  } catch {
    /* voir plus haut */
  }
}
