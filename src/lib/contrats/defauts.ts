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

// ── Durée, préavis et non-concurrence (section 237, lot 4) ─────────────────────────────────
//
// Ces valeurs viennent des modèles-types CNOMK et CNOI, ou des usages qu'ils décrivent. Elles
// sont plausibles — c'est pourquoi elles restent des DÉFAUTS et non des champs obligatoires,
// contrairement au salaire du lot 2, où `0` n'était pas une valeur mais son absence.
//
// Ce qui change au lot 4 n'est donc pas leur valeur, c'est leur VISIBILITÉ : aucune ne partait
// vers le PDF sans que l'écran ne l'ait montrée. Vingt-quatre paramètres étaient dans ce cas.

/** Préavis de rupture d'un CDI, en jours. */
export const PREAVIS_JOURS_DEFAUT = 30;

/** Préavis de rupture d'un commun accord (modèles infirmier), en jours. */
export const PREAVIS_COMMUN_ACCORD_JOURS_DEFAUT = 8;

/** Préavis de rupture unilatérale (modèles infirmier), en jours. */
export const PREAVIS_UNILATERAL_JOURS_DEFAUT = 8;

/** Préavis pendant la période d'essai d'une collaboration infirmier, en jours. */
export const PREAVIS_ESSAI_JOURS_DEFAUT = 15;

/** Période d'essai d'une collaboration infirmier, en mois. */
export const PERIODE_ESSAI_MOIS_INFIRMIER_DEFAUT = 3;

/** Période d'essai d'un CDI, en mois. Cadres exclus — 2 mois est le régime de droit commun. */
export const PERIODE_ESSAI_MOIS_CDI_DEFAUT = 2;

/** Nombre de renouvellements d'une collaboration infirmier. */
export const RENOUVELLEMENTS_MAX_DEFAUT = 1;

/** Durée totale maximale d'une collaboration infirmier, renouvellements compris, en mois. */
export const DUREE_MAX_MOIS_DEFAUT = 24;

/** Durée initiale d'une collaboration, en mois, quand l'annonce n'en déclare aucune. */
export const DUREE_MOIS_DEFAUT = 12;

/** Durée de la clause de non-concurrence d'un CDI, en mois. */
export const NON_CONCURRENCE_DUREE_MOIS_DEFAUT = 12;

/** Contrepartie financière de la non-concurrence d'un CDI, en % du salaire.
 *  Une clause de non-concurrence SANS contrepartie financière est nulle : ce n'est pas un
 *  réglage cosmétique, c'est ce qui rend la clause opposable. */
export const NON_CONCURRENCE_INDEMNITE_PCT_DEFAUT = 25;

/** Durée initiale d'une collaboration : celle de l'annonce si elle en porte une. */
export function dureeMoisParDefaut(
  missionTitulaire: { minMonths?: number | null } | null | undefined,
  missionCandidat: { minMonths?: number | null } | null | undefined,
): number {
  return missionTitulaire?.minMonths ?? missionCandidat?.minMonths ?? DUREE_MOIS_DEFAUT;
}

// ── CDD SALARIÉ INFIRMIER (section 259) ──────────────────────────────────────────────────────
//
// Valeurs par défaut des champs que le modèle CNOI laisse en pointillés. Elles ne sont PAS des
// recommandations juridiques : ce sont des points de départ modifiables à l'écran, comme partout
// ailleurs depuis la section 241 — aucune valeur n'atteint le PDF sans y être passée.

/** Indemnité de fin de contrat. 10 % est le taux LÉGAL (art. L.1243-8 du Code du travail), pas
 *  un choix : le modèle l'écrit en toutes lettres. Reste paramétrable parce qu'une convention
 *  collective peut prévoir mieux, jamais moins. */
export const INDEMNITE_PRECARITE_PCT_DEFAUT = 10;

/** Préavis en MOIS — le modèle CNOI compte en mois là où le CDI kiné comptait en jours. */
export const PREAVIS_MOIS_CDD_DEFAUT = 1;

/** Nombre de mois servant de référence au calcul de la contrepartie de non-concurrence. */
export const NON_CONCURRENCE_MOIS_REFERENCE_DEFAUT = 12;

/** Dommages-intérêts forfaitaires en cas de non-respect de la clause de non-concurrence, en
 *  euros. Le modèle laisse le montant entièrement libre ; ce défaut est délibérément BAS, pour
 *  qu'un montant non relu ne soit pas un montant lourd. */
export const NON_CONCURRENCE_DOMMAGES_EUROS_DEFAUT = 1000;

/** Délai pendant lequel l'employeur peut renoncer à la clause, en jours après la rupture. */
export const NON_CONCURRENCE_RENONCIATION_JOURS_DEFAUT = 15;
