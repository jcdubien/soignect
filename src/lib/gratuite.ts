// Ce qui est gratuit pour un établissement — SOURCE UNIQUE de la mention affichée sur les pages
// « emploi » et dans l'offre partenaire (parcours établissement, point 3, 22/10).
//
// CE QUI EST VRAI PAR LE CODE (vérifié le 22/10) : publier une offre (api/missions), voir les
// disponibilités dans le fil et échanger après une mise en relation ne passent par aucun contrôle
// d'abonnement. Seule la génération d'un contrat PDF libéral dépend du Premium
// (`hasPremiumAccess`) — et un poste salarié n'en a pas : « le contrat de travail est établi par
// l'établissement ». Le mode lancement (`freeAccessMode`) ouvre en plus tout le Premium à tous.
// Ce que deviendra la grille après le lancement est une décision commerciale : la mention ne
// promet donc rien au-delà de ce que le code fait aujourd'hui.

export const GRATUIT_POUR_ETABLISSEMENT = "publier vos offres, voir les disponibilités des candidats et échanger avec eux";

export function mentionGratuite(freeAccessMode: boolean): string {
  return freeAccessMode
    ? `Gratuit pendant le lancement : ${GRATUIT_POUR_ETABLISSEMENT}.`
    : `Gratuit : ${GRATUIT_POUR_ETABLISSEMENT}.`;
}

// ── GRATUIT POUR LES PRATICIENS, PAYANT POUR LES INSTITUTIONS (27/10) ─────────────────────────
//
// Décision de JC après l'audit du 27/10 (aucun compte payant sur 123 ; concurrence gratuite ;
// un abonnement mensuel pour un besoin ponctuel ne se vend pas à un libéral). Un praticien —
// cabinet libéral, remplaçant, assistant, collaborateur — a tout Soignect sans abonnement, que le
// mode lancement soit actif ou non. Seules les institutions paient (établissements : abonnement
// Structure ; CPTS, MSP, hôpitaux : offre partenaire, lib/tarifsPartenaire). Lu par
// `hasPremiumAccess`, la bascule payante (lib/billing), le paiement et /premium.
export const PRATICIENS_GRATUITS = true;

/** Ce qu'un praticien a gratuitement — vrai par le code : aucune de ces actions ne passe par un
 *  contrôle d'abonnement quand `PRATICIENS_GRATUITS` est vrai. */
export const GRATUIT_POUR_PRATICIEN = [
  "Publier vos annonces et vos disponibilités",
  "Le fil des annonces et les mises en relation",
  "La messagerie",
  "Vos contrats préparés, signés en ligne et partagés",
  "Le Planning de votre cabinet",
] as const;

/** Ligne qui sépare l'offre partenaire (payante) de la publication (gratuite). */
export const OFFRE_PARTENAIRE_FACULTATIVE =
  "Facultative : elle ne conditionne ni la publication de vos offres ni l'accès aux candidats.";
