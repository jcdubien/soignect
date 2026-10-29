// Libellés et destination de l'inscription selon le type de compte (22/10, parcours établissement,
// point 1). Pur, lu par /register — une seule écriture de « qui s'inscrit » et « où il arrive ».

import { professionPluriel } from "@/lib/professions";
import { contratFourniParEmployeur } from "@/lib/contrats/gabaritsSalarie";

export type TypeInscription = "TITULAIRE" | "REMPLACANT" | "ASSISTANT";

/** « établissement qui recrute des infirmiers », « remplaçant·e »… — ce qui suit « Inscription
 *  en tant que ». La profession n'est nommée que côté recruteur : c'est celle qu'il RECHERCHE, et
 *  c'est ce que le champ « Profession recherchée » ne suffit pas à dire au premier regard. */
export function libelleInscription(type: TypeInscription, structure: boolean, profession: string): string {
  const recrute = profession ? ` qui recrute des ${professionPluriel(profession)}` : "";
  if (type === "TITULAIRE") return (structure ? "établissement" : "cabinet") + recrute;
  if (type === "ASSISTANT") return "assistant·e / collaborateur·rice";
  // Un seul chercheur de poste depuis le 29/10 (section 378) : remplacement, assistanat,
  // collaboration ou salariat se choisissent dans la disponibilité, pas à l'inscription.
  return contratFourniParEmployeur(profession) ? "candidat·e à un poste salarié" : "candidat·e";
}

/** Le préfixe, élidé devant voyelle : « en tant qu’ » (établissement, assistant·e) ou
 *  « en tant que » (cabinet, remplaçant·e). Le libellé suit, mis en forme par l'appelant. */
export function enTantQue(libelle: string): string {
  return /^[aeéiou]/i.test(libelle) ? "en tant qu’" : "en tant que ";
}

/** Titre de l'écran 2 — et de l'en-tête au-dessus de la carte, qui disait « Votre identité »
 *  à un établissement. */
export function titreIdentite(type: TypeInscription | "", structure: boolean): string {
  return type === "TITULAIRE" ? (structure ? "Votre établissement" : "Votre cabinet") : "Votre identité";
}

/** Où arrive un compte qui vient de naître (section 225). Un ÉTABLISSEMENT arrive sur la
 *  publication d'offre : il est venu « publier une offre », et le fil d'un compte qui n'a rien
 *  publié ne montre que des candidats qu'il ne peut pas encore joindre. Les cabinets restent sur
 *  le fil — décision de la section 225, non rouverte ici. */
export function destinationApresInscription(type: TypeInscription | "", structure: boolean): string {
  if (type === "TITULAIRE") return structure ? "/missions/create" : "/annonces";
  return "/disponibilites/create";
}
