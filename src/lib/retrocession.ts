import { RetrocessionMode } from "@prisma/client";

// ── TROIS FAÇONS DE RÉMUNÉRER UN REMPLAÇANT LIBÉRAL (section 293) ────────────────────────────
//
// ⚠️ LE PIÈGE DU MOT. `Mission.retrocessionRate` stocke la part que le REMPLAÇANT PERÇOIT, pas
// celle qu'il reverse. Le défaut de 70 et l'article 6 du contrat le disent — « le remplaçant
// percevra 70% des honoraires qu'il aura encaissés ». L'usage, lui, appelle « rétrocession » les
// 30% qui reviennent au cabinet. Les deux lectures coexistent dans le métier ; la colonne n'en
// retient qu'une, et ce fichier est l'endroit où elle est écrite noir sur blanc.
//
// Cette convention n'a PAS été touchée en ajoutant les deux modes. L'inverser aurait réinterprété
// quatre-vingts annonces en base et chaque contrat déjà signé — un 70 devenu 30 sur un document
// que deux personnes ont paraphé.
//
// ── CE QUE CHAQUE MODE VEUT DIRE ────────────────────────────────────────────────────────────
//
//   POURCENTAGE  le remplaçant perçoit N % de ce qu'il encaisse.          (comportement d'avant)
//   FIXE         il perçoit un montant mensuel, quel que soit son CA.     Le cabinet porte le
//                risque d'activité, et c'est précisément ce qu'il vend.
//   PLAFONNEE    il perçoit N %, MAIS la part gardée par le cabinet ne
//                dépasse jamais P €/mois. Au-delà, tout lui reste.        Un remplaçant très
//                productif n'est plus pénalisé par son propre volume.
//
// L'UNITÉ EST LE MOIS, pour les deux montants. Arbitrage du 09/10 : `remunerationBrute` est déjà
// mensuelle, et les postes longue durée raisonnent en mois. Un remplacement de trois jours s'en
// accommode moins bien — c'est le coût assumé d'une unité unique, contre la confusion certaine
// qu'aurait produite un sélecteur jour/semaine/mois à côté de chaque montant.

export { RetrocessionMode };

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
 * Phrase courte pour une carte ou une fiche d'annonce.
 *
 * `null` quand rien n'est renseigné : une annonce sans rétrocession déclarée ne doit afficher
 * AUCUNE mention, surtout pas « 70 % » hérité du défaut de génération de contrat. Ce défaut est
 * une valeur de repli au moment de rédiger un contrat, pas une promesse faite dans le fil.
 */
export function resumeRetrocession(r: Retrocession): string | null {
  switch (r.mode) {
    case "FIXE":
      return r.fixeEuros ? `Forfait ${euros(r.fixeEuros)}/mois` : null;

    case "PLAFONNEE":
      // Un plafond annoncé sans montant ne se dégrade PAS en simple pourcentage : « 75 % pour le
      // remplaçant » décrirait un accord non plafonné, c'est-à-dire la lecture la plus favorable
      // d'une annonce qui ne la promet pas. On n'affiche rien.
      return r.rate && r.plafondEuros
        ? `${r.rate} % pour le remplaçant · part du cabinet plafonnée à ${euros(r.plafondEuros)}/mois`
        : null;

    case "POURCENTAGE":
    default:
      // « DES HONORAIRES POUR LE REMPLAÇANT », en toutes lettres. `retrocessionRate` est la part
      // qu'il PERÇOIT (défaut 70, article 6 : « le remplaçant percevra 70% »), quand l'usage
      // appelle « rétrocession » les 30 % qui reviennent au cabinet. Écrire « 75 % de
      // rétrocession » laissait donc le lecteur choisir le sens — sur une image publique, sans
      // personne à qui demander.
      return r.rate ? `${r.rate} % des honoraires pour le remplaçant` : null;
  }
}

/**
 * Article 6 du contrat de remplacement (CNOMK).
 *
 * UNE SEULE FONCTION POUR LES TROIS MODES, et elle vit ici plutôt que dans le gabarit : la
 * phrase imprimée et la phrase affichée dans le fil doivent décrire le même accord. Les séparer,
 * c'est accepter qu'une annonce promette un plafond que le contrat ne mentionne pas.
 *
 * Le texte du mode POURCENTAGE est repris MOT POUR MOT de l'article d'origine : un contrat déjà
 * signé et un contrat généré aujourd'hui dans le même mode doivent se lire à l'identique.
 */
export function clauseRetrocession(r: Retrocession, pctParDefaut: number): string {
  const pct = r.rate ?? pctParDefaut;

  if (r.mode === "FIXE" && r.fixeEuros) {
    return (
      `En rémunération de ses services, le remplaçant percevra une somme forfaitaire de ` +
      `${euros(r.fixeEuros)} par mois, quel que soit le montant des honoraires encaissés pendant ` +
      `la durée du remplacement. Cette somme est calculée au prorata pour toute période ` +
      `incomplète.`
    );
  }

  if (r.mode === "PLAFONNEE" && r.plafondEuros) {
    return (
      `En rémunération de ses services, le remplaçant percevra ${pct}% des honoraires qu'il aura ` +
      `encaissés pendant la durée du remplacement, sans que la part conservée par le remplacé ` +
      `puisse excéder ${euros(r.plafondEuros)} par mois. Au-delà de ce plafond, les honoraires ` +
      `encaissés restent intégralement acquis au remplaçant.`
    );
  }

  // Repli : POURCENTAGE, ou un mode dont le montant manque. Mieux vaut l'article d'origine,
  // juridiquement éprouvé, qu'une phrase tronquée sur un montant absent.
  return (
    `En rémunération de ses services, le remplaçant percevra ${pct}% des honoraires qu'il aura ` +
    `encaissés pendant la durée du remplacement.`
  );
}
