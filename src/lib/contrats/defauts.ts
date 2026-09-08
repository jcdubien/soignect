// Valeurs par défaut du contrat calculées à partir des données déjà en base (section 237).
//
// POURQUOI UN MODULE PARTAGÉ. Ces valeurs sont nécessaires DEUX fois : la route de génération les
// applique, et `contrat-info` doit les renvoyer pour que l'écran les affiche AVANT génération —
// règle posée par Jean-Charles : aucune valeur par défaut ne doit atteindre le PDF sans que
// l'écran l'ait montrée au moins une fois. Deux copies de la même formule finiraient par
// diverger, et l'écran annoncerait alors une valeur que le document ne reprendrait pas.
//
// Voir `periode.ts` pour la même règle appliquée aux dates.

/** Ce qu'une annonce apporte au lieu de travail. Structurel : les deux routes chargent des
 *  `select` différents et n'ont pas à partager un type Prisma complet. */
type MissionLieu = { location?: string | null } | null | undefined;
type ProfilNom = { name?: string | null } | null | undefined;

/**
 * Lieu de travail porté au contrat de travail, à défaut de saisie.
 *
 * L'adresse de l'annonce du recruteur d'abord — c'est celle du poste —, son nom ensuite. Le
 * dernier repli reste générique : un contrat de travail dont le lieu d'exécution manque doit le
 * dire, et le gabarit imprime alors « [adresse du lieu de travail à compléter] ».
 */
export function lieuTravailParDefaut(missionTitulaire: MissionLieu, profilTitulaire: ProfilNom): string {
  return missionTitulaire?.location ?? profilTitulaire?.name ?? "cabinet";
}

/** Durée légale hebdomadaire (art. L.3121-27). Défaut du temps complet, affiché à l'écran. */
export const HEURES_HEBDOMADAIRES_DEFAUT = 35;

/** Plafond d'heures complémentaires proposé pour un temps partiel, modifiable. */
export const HEURES_COMPLEMENTAIRES_DEFAUT = 4;
