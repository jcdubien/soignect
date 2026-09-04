import { ProfileType } from "@prisma/client";

// Le CAMP d'un profil : ce que le produit montre, là où `ProfileType` est ce qu'il stocke.
//
// POURQUOI DEUX ET NON TROIS. REMPLACANT et ASSISTANT doivent fusionner en une seule catégorie
// « chercheur » (décision du 26/08). Exposer trois options égales et définitives installerait
// dans l'interface une distinction qu'on a prévu de supprimer, et que l'utilisateur devrait
// comprendre pour rien. La fusion elle-même n'est pas faite ici : `ProfileType` garde ses trois
// valeurs, seule leur PRÉSENTATION est ramenée à deux.
//
// Ce module vit hors des routes : un fichier de route Next ne peut exporter que ses handlers,
// tout autre export casse la compilation.

export type Camp = "TITULAIRE" | "CHERCHEUR";

export function campDe(type: ProfileType): Camp {
  return type === ProfileType.TITULAIRE ? "TITULAIRE" : "CHERCHEUR";
}

/** Type stocké pour un camp donné. CHERCHEUR retombe sur REMPLACANT — voir l'avertissement
 *  affiché à l'écran : la sous-catégorie ASSISTANT n'est pas mémorisée au retour. */
export function typePourCamp(camp: Camp): ProfileType {
  return camp === "TITULAIRE" ? ProfileType.TITULAIRE : ProfileType.REMPLACANT;
}

/**
 * Un swipe n'a de sens qu'ENTRE CAMPS OPPOSÉS (section 226, 03/09).
 *
 * POURQUOI CET INVARIANT EXISTE. Le feed ne présente que le camp d'en face : un swipe de même
 * camp ne peut donc pas naître aujourd'hui. Mais il peut SURVIVRE — quelqu'un qui change de camp
 * garde ses gestes passés, et ceux-ci deviennent alors des affirmations fausses. Constaté le
 * 03/09 : Etienne harzee s'était inscrit comme remplaçant, avait swipé cinq annonces dans la
 * minute, puis était devenu titulaire ; il figurait depuis lors parmi les « personnes
 * intéressées » de trois cabinets, avec son offre de recrutement en guise d'accroche, et voyait
 * de son côté cinq annonces de cabinets dans « Vos choix », sans match possible.
 *
 * LE FILTRE EST À LA LECTURE, PAS À L'ÉCRITURE. Supprimer les swipes au moment du basculement ne
 * réparerait que les bascules FUTURES : les lignes déjà en base resteraient fausses. Ici la règle
 * vaut quelle que soit la façon dont la donnée est arrivée — et elle ne détruit rien, ce qui suit
 * la décision « désactiver, ne rien supprimer » prise pour le changement de camp (section 222).
 */
export function swipeExploitable(
  typeDuSwipeur: ProfileType | string,
  typeDuProprietaire: ProfileType | string,
): boolean {
  return campDe(typeDuSwipeur as ProfileType) !== campDe(typeDuProprietaire as ProfileType);
}
