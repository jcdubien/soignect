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
