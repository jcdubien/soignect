import type { Profession } from "@prisma/client";

// Libellés des professions — source unique, et surtout TYPÉE (section 196).
//
// Deux correspondances existaient, dont une fausse. Celle du contrat était déclarée
// `Record<string, string>` : un type qui n'impose rien. Elle mappait KINESITHERAPEUTE,
// OSTEOPATHE et CHIROPRACTEUR — les deux derniers absents de l'enum — et oubliait INFIRMIER,
// ORTHOPHONISTE, SAGE_FEMME et MEDECIN, qui y sont. Avec `map[p] ?? p`, un contrat d'infirmier
// aurait imprimé « INFIRMIER » en capitales à la ligne « Profession ».
//
// `Record<Profession, string>` interdit cet écart : ajouter une valeur à l'enum casse la
// compilation tant que son libellé n'est pas écrit. C'est le type qui répare le défaut, pas
// la correction des clés — celle-là n'aurait tenu que jusqu'au prochain oubli.

// Usage courant : interface, listes déroulantes, affichage de profil.
export const PROFESSION_LABELS: Record<Profession, string> = {
  KINESITHERAPEUTE: "Kinésithérapeute",
  INFIRMIER:        "Infirmier·ère",
  ORTHOPHONISTE:    "Orthophoniste",
  SAGE_FEMME:       "Sage-femme",
  MEDECIN:          "Médecin",
};

// Dénomination LÉGALE, pour les documents contractuels. Elle diffère volontairement de l'usage
// courant : un contrat désigne un « masseur-kinésithérapeute », titre protégé par le code de la
// santé publique, là où l'interface dit « kinésithérapeute ». Les deux registres coexistent,
// ce n'est pas une duplication à réduire.
export const PROFESSION_LABELS_CONTRAT: Record<Profession, string> = {
  KINESITHERAPEUTE: "Masseur-kinésithérapeute",
  INFIRMIER:        "Infirmier diplômé d'État",
  ORTHOPHONISTE:    "Orthophoniste",
  SAGE_FEMME:       "Sage-femme",
  MEDECIN:          "Médecin",
};

// La valeur vient de la base : elle est typée Profession côté Prisma, mais transite en string
// dans les routes. Le repli conserve la valeur brute plutôt que de masquer une incohérence.
export function professionLabel(p: string, registre: "usuel" | "contrat" = "usuel"): string {
  const table = registre === "contrat" ? PROFESSION_LABELS_CONTRAT : PROFESSION_LABELS;
  return table[p as Profession] ?? p;
}
