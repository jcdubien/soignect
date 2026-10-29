// Demande de partenariat (22/10) — source unique des libellés, des types proposés et des règles
// du formulaire public /partenaire. Pur : lu par la page, la route publique et l'administration.
//
// POURQUOI UN FORMULAIRE ET PAS UNE INSCRIPTION. Les boutons « Devenir partenaire » et « Échanger
// sur un partenariat » des pages territoire et maison de santé menaient à /register : une CPTS
// tombait sur « Je suis… Cabinet / Remplaçant ». Elle n'a pas de compte soignant à créer. Ce
// qu'elle demande, c'est d'être recontactée ; ce que l'administrateur en fait, c'est un client
// institutionnel, une page et un éditeur — trois gestes que la conversion fait en un.

import type { Profession, TypeInstitution } from "@prisma/client";

/** Types proposés dans le formulaire, dans l'ordre d'affichage. ARS et CGSS n'y sont pas : ce
 *  sont des relations institutionnelles, pas des prospects d'un formulaire public. */
export const TYPES_PARTENAIRE: readonly { type: TypeInstitution; libelle: string }[] = [
  { type: "CPTS", libelle: "CPTS" },
  { type: "COLLECTIVITE", libelle: "Collectivité" },
  { type: "MSP", libelle: "Maison de santé (MSP)" },
  { type: "EHPAD", libelle: "EHPAD" },
  { type: "SSIAD", libelle: "SSIAD" },
  { type: "SSR", libelle: "SSR" },
  { type: "CLINIQUE", libelle: "Clinique" },
  { type: "HOPITAL", libelle: "Hôpital" },
  { type: "AUTRE", libelle: "Autre structure" },
];

export const TYPES_PARTENAIRE_ACCEPTES = TYPES_PARTENAIRE.map((t) => t.type);

export function libelleTypePartenaire(type: TypeInstitution): string {
  return TYPES_PARTENAIRE.find((t) => t.type === type)?.libelle ?? type;
}

/** Professions qu'on peut cocher : celles qui ont des pages et un fil peuplé. */
export const PROFESSIONS_PARTENAIRE: readonly Profession[] = ["KINESITHERAPEUTE", "INFIRMIER", "AIDE_SOIGNANT"];

/** Lien vers le formulaire depuis une page de diffusion. `type` présélectionne la structure ;
 *  l'île, quand ce n'est pas la Guadeloupe (île par défaut), est cochée d'office (section 379). */
export function lienPartenariat(type: TypeInstitution, source: string, ile?: string): string {
  return `/partenaire?type=${type}${ile && ile !== "GUADELOUPE" ? `&territoire=${ile}` : ""}&src=${encodeURIComponent(source)}`;
}

export const LIMITES_PARTENARIAT = {
  structure: 160, contactNom: 120, fonction: 120, email: 200, telephone: 30, message: 1000,
  /** Communes cochables au plus — une CPTS couvre rarement plus ; au-delà, le message suffit. */
  communes: 40,
  /** Demandes acceptées par adresse email sur 24 h — au-delà, refus poli (abus ou double clic). */
  parEmailParJour: 3,
} as const;

/** Ce que voit la personne après envoi. Ne promet ni délai ni tarif : seulement ce qui se passe. */
export const CONFIRMATION_PARTENARIAT =
  "Demande reçue. Nous revenons vers vous pour en parler ; rien n'est engagé ni facturé à ce stade.";

/** Nom proposé au client institutionnel à la conversion — modifiable avant de valider. */
export function nomClientPropose(d: { structure: string }): string {
  return d.structure.trim().replace(/\s+/g, " ").slice(0, 160);
}

/** Échéance de revue posée à la conversion : 6 mois, l'intervalle retenu (schéma, `revueLe`). */
export const REVUE_CONVERSION_MOIS = 6;
