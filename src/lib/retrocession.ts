import { RetrocessionMode } from "@prisma/client";

// ── RÉTROCESSION D'UN REMPLAÇANT, REDEVANCE D'UN ASSISTANT OU D'UN COLLABORATEUR ──────────────
//
// ⚠️ LE MÊME CHAMP PORTE DEUX SENS. `Mission.retrocessionRate` stocke :
//   • sur un REMPLACEMENT, la part que le REMPLAÇANT PERÇOIT (défaut 70, article 6 : « le
//     remplaçant percevra 70% des honoraires qu'il aura encaissés ») ;
//   • sur un ASSISTANAT ou une COLLABORATION, la REDEVANCE que l'assistant ou le collaborateur
//     VERSE au titulaire (article 4/5 : « l'assistant versera au titulaire une redevance de N% »).
// Cette convention n'a PAS été touchée : l'inverser aurait réinterprété chaque annonce en base et
// chaque contrat déjà signé.
//
// ── LES MODES FIXE ET PLAFONNÉE SONT RÉSERVÉS À L'ASSISTANAT ET À LA COLLABORATION (section 296)
//
// Livrés d'abord sur le remplacement (section 293), à contresens de l'usage. Arbitrage du 13/10 :
// un forfait ou un plafond se négocie sur une REDEVANCE de long terme — l'assistant ou le
// collaborateur verse au titulaire une somme fixe, ou un pourcentage qui ne dépasse jamais P €
// par mois. Un remplaçant, lui, est rétrocédé en pourcentage, point. Collaborateur = assistant
// (même statut, mêmes besoins) : les deux reçoivent les mêmes modes.
//
//   POURCENTAGE  la redevance vaut N % des honoraires encaissés.     (comportement d'avant)
//   FIXE         la redevance est un montant mensuel, quel que soit le CA. L'assistant porte le
//                risque d'activité ; le titulaire connaît sa recette.
//   PLAFONNEE    N %, MAIS la redevance ne dépasse jamais P €/mois.  Un assistant très productif
//                n'est plus pénalisé par son propre volume.
//
// Le plafond porte donc toujours sur la part du CABINET — ici, c'est exactement la redevance.
//
// L'UNITÉ EST LE MOIS, pour les deux montants : les postes longue durée raisonnent en mois, et la
// redevance est déjà « mensuelle » dans les deux gabarits.
//
// Aucune annonce n'avait quitté POURCENTAGE au moment de la bascule (vérifié en base le 13/10 :
// 58 remplacements, 28 assistanats, 4 collaborations, tous en POURCENTAGE) — rien à migrer.

export { RetrocessionMode };

/**
 * Les modes FIXE et PLAFONNEE n'existent que sur une redevance libérale de long terme.
 *
 * PAS POUR LES INFIRMIERS : la collaboration infirmier imprime l'article 7 du modèle CNOI,
 * clause réglementaire au pourcentage du chiffre d'affaires. Offrir un forfait sur l'annonce
 * promettrait un accord que ce contrat n'imprime pas.
 */
export function modesRedevanceAutorises(
  missionType: string | null | undefined,
  estSalariat: boolean,
  profession: string | null | undefined,
): boolean {
  return (
    !estSalariat &&
    profession !== "INFIRMIER" &&
    (missionType === "ASSISTANAT" || missionType === "COLLABORATION")
  );
}

/**
 * Ne laisse survivre que le montant du mode retenu, et ramène à POURCENTAGE tout mode posé là où
 * il n'a pas de sens. Appliqué dans les routes, où la règle ne peut pas être contournée : l'écran
 * masque un champ mais garde la valeur tapée, et un plafond oublié finirait imprimé.
 */
export function normaliserRetrocession(
  autorise: boolean,
  mode: RetrocessionMode | null | undefined,
  fixeEuros: number | null | undefined,
  plafondEuros: number | null | undefined,
): { retrocessionMode: RetrocessionMode; retrocessionFixeEuros: number | null; retrocessionPlafondEuros: number | null } {
  const m: RetrocessionMode = autorise && mode ? mode : "POURCENTAGE";
  return {
    retrocessionMode: m,
    retrocessionFixeEuros: m === "FIXE" ? (fixeEuros ?? null) : null,
    retrocessionPlafondEuros: m === "PLAFONNEE" ? (plafondEuros ?? null) : null,
  };
}

export const LIBELLE_MODE: Record<RetrocessionMode, string> = {
  POURCENTAGE: "Pourcentage des honoraires",
  FIXE: "Montant fixe mensuel",
  PLAFONNEE: "Pourcentage, part du cabinet plafonnée",
};

export interface Retrocession {
  mode: RetrocessionMode;
  rate: number | null;
  fixeEuros: number | null;
  plafondEuros: number | null;
}

// ── LE SÉPARATEUR DE MILLIERS NE PEUT PAS ÊTRE CELUI DE `toLocaleString` (section 295) ──────
//
// `(12500).toLocaleString("fr-FR")` rend « 12 500 » avec une ESPACE FINE INSÉCABLE (U+202F).
// Vérifié : `[...s].map(c => c.codePointAt(0))` donne bien 202F. Ce caractère est absent de
// beaucoup de polices — dans l'image de partage, rendue par Satori avec une police embarquée, il
// sortirait en carré vide au milieu du montant, sur la seule surface que personne ne peut
// corriger après coup : une image déjà scrapée par Facebook.
//
// On formate donc à la main, avec une espace insécable simple (U+00A0), présente partout.
const ESPACE_INSECABLE = "\u00A0";
const euros = (n: number) =>
  `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_INSECABLE)}${ESPACE_INSECABLE}€`;

/**
 * Phrase courte d'une annonce de REMPLACEMENT — pourcentage seulement (section 296).
 *
 * `null` quand rien n'est renseigné : une annonce sans rétrocession déclarée ne doit afficher
 * AUCUNE mention, surtout pas « 70 % » hérité du défaut de génération de contrat. Ce défaut est
 * une valeur de repli au moment de rédiger un contrat, pas une promesse faite dans le fil.
 *
 * « DES HONORAIRES POUR LE REMPLAÇANT », en toutes lettres : `retrocessionRate` est la part qu'il
 * PERÇOIT, quand l'usage appelle « rétrocession » les 30 % qui reviennent au cabinet.
 */
export function resumeRetrocession(r: Pick<Retrocession, "rate">): string | null {
  return r.rate ? `${r.rate} % des honoraires pour le remplaçant` : null;
}

/**
 * Phrase courte de la redevance d'un ASSISTANAT ou d'une COLLABORATION.
 *
 * Un plafond annoncé sans montant ne se dégrade PAS en simple pourcentage : « 25 % » décrirait
 * un accord non plafonné, c'est-à-dire la lecture la moins favorable d'une annonce qui promet
 * mieux. On n'affiche rien.
 */
export function resumeRedevance(r: Retrocession): string | null {
  switch (r.mode) {
    case "FIXE":
      return r.fixeEuros ? `Redevance forfaitaire ${euros(r.fixeEuros)}/mois` : null;
    case "PLAFONNEE":
      return r.rate && r.plafondEuros
        ? `Redevance ${r.rate} % des honoraires, plafonnée à ${euros(r.plafondEuros)}/mois`
        : null;
    case "POURCENTAGE":
    default:
      return r.rate ? `Redevance ${r.rate} % des honoraires` : null;
  }
}

/**
 * Article « Redevance » des contrats d'assistanat (art. 4) et de collaboration (art. 5).
 *
 * UNE SEULE FONCTION POUR LES TROIS MODES, ici plutôt que dans les gabarits : l'annonce et le
 * contrat doivent décrire le même accord. Le mode POURCENTAGE reprend MOT POUR MOT la phrase
 * d'origine — un contrat déjà signé et un contrat généré aujourd'hui doivent se lire à
 * l'identique. Repli sur cette phrase quand le montant du mode manque.
 *
 * `debiteur` : « l'assistant » ou « le collaborateur ». `objet` : ce que la redevance rémunère,
 * propre à chaque gabarit.
 */
export function clauseRedevance(
  r: Retrocession,
  pctParDefaut: number,
  debiteur: string,
  objet: string,
): string {
  const pct = r.rate ?? pctParDefaut;
  const intro = `En contrepartie de ${objet}, ${debiteur} versera au titulaire`;

  if (r.mode === "FIXE" && r.fixeEuros) {
    return (
      `${intro} une redevance forfaitaire de ${euros(r.fixeEuros)} par mois, quel que soit le ` +
      `montant des honoraires encaissés. Cette somme est calculée au prorata pour tout mois ` +
      `incomplet.`
    );
  }

  if (r.mode === "PLAFONNEE" && r.plafondEuros) {
    return (
      `${intro} une redevance mensuelle de ${pct}% de ses honoraires nets encaissés, sans que ` +
      `cette redevance puisse excéder ${euros(r.plafondEuros)} par mois.`
    );
  }

  return `${intro} une redevance mensuelle de ${pct}% de ses honoraires nets encaissés.`;
}
