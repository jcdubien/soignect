// Les deux côtés d'une mise en relation, et ce que leur paire d'annonces détermine (section 238).
//
// LE DÉFAUT QUE CE FICHIER FERME. `contrat-info` et la route de génération répartissaient chacune
// le match en « titulaire » et « candidat », puis en déduisaient le type de contrat — avec des
// opérandes différents :
//
//   contrat-info  : missionType = match.missionA?.missionType ?? match.missionB?.missionType
//   génération    : missionType = missionTitulaire?.missionType ?? missionAutre?.missionType
//
// La première lit l'annonce de `profileA`, qui n'est le titulaire qu'une fois sur deux — l'ordre
// A/B vient de qui a été enregistré en premier, il n'a aucun sens métier. Les deux routes
// répondaient donc des types différents dès que les deux annonces divergeaient.
//
// Constaté le 08/09 sur la mise en relation `cmsvtatr` : l'annonce du candidat dit ASSISTANAT,
// celle du recruteur COLLABORATION. L'écran, lisant la première, annonçait « Assistanat libéral »
// puis « aucun modèle de contrat n'existe » — alors que la route, lisant la seconde, produisait
// sans difficulté un CDI. L'écran refusait ce que le produit savait faire.
//
// C'est la troisième occurrence du même motif en deux semaines : une règle recopiée dans deux
// fichiers finit par diverger. Voir `CONTRACT_IDENTITY_SELECT` (section 236, la copie avait perdu
// `name`) et `periode.ts` (section 237, sept copies de la même dérivation de dates).
//
// LA RÈGLE RETENUE EST CELLE DE LA GÉNÉRATION : l'annonce du TITULAIRE d'abord. C'est elle qui
// décrit le poste à pourvoir, donc le contrat à établir. L'annonce du candidat dit ce qu'il
// cherche — utile pour le rapprochement, pas pour qualifier l'engagement. Aligner l'écran sur le
// PDF, et non l'inverse, était le seul sens possible : c'est le PDF qui est signé.

/** Forme minimale exigée d'un match. Générique sur les profils et les missions : les deux routes
 *  chargent des `select` différents et n'ont pas à partager un type Prisma complet. */
interface MatchCotes<P extends { type: string }, M> {
  profileA: P;
  profileB: P;
  missionA: M | null | undefined;
  missionB: M | null | undefined;
}

export interface Cotes<P, M> {
  profilTitulaire: P;
  profilCandidat: P;
  missionTitulaire: M | null | undefined;
  missionCandidat: M | null | undefined;
  /** `true` si `profileA` porte bien le rôle de titulaire — sinon les côtés sont inversés. */
  aEstTitulaire: boolean;
}

/**
 * Répartit un match en côté titulaire et côté candidat.
 *
 * QUAND AUCUN DES DEUX N'EST TITULAIRE. `Profile.type` reste modifiable après la mise en relation ;
 * les deux côtés peuvent donc se retrouver `REMPLACANT`. On retient alors `profileB` comme
 * titulaire — la convention qu'appliquait déjà la route de génération, et donc celle qui décrit ce
 * que le PDF contient réellement. `contrat-info` renvoyait `null` dans ce cas et en déduisait
 * « ce n'est pas un salariat », quand la génération, elle, pouvait partir dans la branche salariée.
 * Deux réponses pour un même état : c'est exactement ce que ce fichier supprime.
 */
export function cotesDuMatch<P extends { type: string }, M>(match: MatchCotes<P, M>): Cotes<P, M> {
  const aEstTitulaire = match.profileA.type === "TITULAIRE";
  return {
    profilTitulaire:  aEstTitulaire ? match.profileA : match.profileB,
    profilCandidat:   aEstTitulaire ? match.profileB : match.profileA,
    missionTitulaire: aEstTitulaire ? match.missionA : match.missionB,
    missionCandidat:  aEstTitulaire ? match.missionB : match.missionA,
    aEstTitulaire,
  };
}

/**
 * Type de contrat déterminé par la paire d'annonces : celle du titulaire d'abord.
 *
 * Renvoie `null` quand aucune des deux annonces n'existe. AUCUN REPLI n'est fourni ici — la route
 * de génération refuse ce cas en 422 (section 210) plutôt que de deviner REMPLACEMENT, et l'écran
 * doit pouvoir dire la même chose. Un type deviné produirait un contrat de remplacement pour un
 * assistanat, faux et signé.
 */
export function typeDeMissionDuContrat<T>(
  missionTitulaire: { missionType: T } | null | undefined,
  missionCandidat: { missionType: T } | null | undefined,
): T | null {
  return missionTitulaire?.missionType ?? missionCandidat?.missionType ?? null;
}
