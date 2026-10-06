import { ProfileType } from "@prisma/client";
import { professionPluriel } from "@/lib/professions";

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

/**
 * Ce qu'une personne doit PUBLIER pour exister dans le fil d'en face (section 229).
 *
 * Vivait en clair dans `api/profiles/route.ts` pour l'email de bienvenue. Déplacé ici dès qu'un
 * second appelant est apparu — la relance : deux copies d'un même vocabulaire finissent toujours
 * par diverger, et celle-ci porte une promesse faite à l'utilisateur.
 *
 * `avecArticle` porte le groupe nominal ENTIER. Composer `la ${mot}` produisait « c'est la
 * annonce », constaté sur un rendu réel le 03/09.
 */
export interface Publication {
  mot: string;
  avecArticle: string;
  label: string;
  path: string;
}

export function publicationPour(type: ProfileType | string): Publication {
  return campDe(type as ProfileType) === "TITULAIRE"
    ? { mot: "annonce",   avecArticle: "l'annonce",    label: "Publier mon annonce",  path: "/missions/create" }
    : { mot: "recherche", avecArticle: "la recherche", label: "Publier ma recherche", path: "/disponibilites/create" };
}

/**
 * À qui l'on devient visible en publiant. Même découpage que la publication elle-même.
 *
 * LA PROFESSION EST UN PARAMÈTRE DEPUIS L'OUVERTURE (section 278), et non plus « kinésithérapeutes »
 * en dur. Cette phrase part dans l'email de bienvenue — le tout premier message reçu — et dans le
 * courrier aux inscrits restés sans publication. À un chirurgien-dentiste qui s'inscrit, elle
 * annonçait qu'il serait vu par des kinésithérapeutes : faux, et faux sur le seul point qui
 * décide s'il publie.
 *
 * Elle n'est demandée QUE du côté titulaire : un candidat devient visible des « cabinets et
 * établissements qui recrutent », phrase vraie dans toutes les professions. La rendre
 * obligatoire des deux côtés aurait fait écrire un argument que l'appelant n'a pas à fournir.
 */
export function cibleVisibilitePour(
  type: ProfileType | string,
  profession?: string | null,
): string {
  return campDe(type as ProfileType) === "TITULAIRE"
    ? `${professionPluriel(profession)} en recherche de poste`
    : "cabinets et établissements qui recrutent";
}
