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

// ── Honoraires et reversements des contrats INFIRMIER (section 237, lot 3) ──────────────────
//
// DEUX SENS OPPOSÉS, À NE JAMAIS CONFONDRE. Les modèles du CNOI font circuler l'argent dans des
// directions inverses selon la variante, et les deux se nomment « pourcentage » :
//
//   • REMPLACEMENT AVEC AUTORISATION — le Remplacé encaisse les honoraires et en REVERSE une part
//     au Remplaçant, qui n'est pas installé. C'est une rétrocession : les taux usuels sont élevés.
//
//   • REMPLACEMENT ENTRE CONFRÈRES — le Remplaçant, lui-même installé, encaisse ses honoraires et
//     VERSE au Remplacé une redevance pour les frais du cabinet. L'Ordre constate un usage de 5 à
//     10 % et rappelle qu'un taux trop élevé s'apparenterait à un partage d'honoraires, interdit
//     par l'article R.4312-30.
//
// Appliquer le défaut de l'un à l'autre ne se trompe pas de quelques points : cela retourne le
// sens du flux financier sur un document destiné à la signature. Les deux constantes portent donc
// des noms distincts, et les deux gabarits lisent des PARAMÈTRES distincts.

/** Part des honoraires que le Remplacé reverse au Remplaçant (modèle avec autorisation). */
export const REVERSEMENT_PCT_DEFAUT = 70;

/** Délai de ce reversement, en mois suivant la fin du remplacement. */
export const REVERSEMENT_DELAI_MOIS_DEFAUT = 1;

/** Redevance de frais de cabinet versée PAR le Remplaçant installé (modèle entre confrères).
 *  Bas de la fourchette constatée par l'Ordre — au-delà de 10 %, l'écran avertit. */
export const REDEVANCE_CABINET_PCT_DEFAUT = 5;

/** Seuil au-delà duquel l'écran rappelle le risque de requalification (R.4312-30). */
export const REDEVANCE_CABINET_SEUIL_ALERTE = 10;

/** Jour du mois où la redevance de collaboration est versée au titulaire. */
export const JOUR_VERSEMENT_REDEVANCE_DEFAUT = 10;

/** Délai de reversement des forfaits de prise en charge, en jours. */
export const FORFAIT_DELAI_REVERSEMENT_JOURS_DEFAUT = 30;
