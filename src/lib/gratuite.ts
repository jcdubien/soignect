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

/** Ligne qui sépare l'offre partenaire (payante) de la publication (gratuite). */
export const OFFRE_PARTENAIRE_FACULTATIVE =
  "Facultative : elle ne conditionne ni la publication de vos offres ni l'accès aux candidats.";
