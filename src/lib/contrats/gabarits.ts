import { MissionType, Profession } from "@prisma/client";

// Registre des gabarits de contrat — quelle profession peut signer quel type de mission, et
// sous quelle variante (section 216).
//
// POURQUOI UNE LISTE PLUTÔT QU'UNE TABLE IMBRIQUÉE
// La sélection se faisait sur `missionType` seul, ce qui supposait qu'un type de mission ait un
// gabarit unique. Deux constats de l'audit du 26-27/08 l'ont démenti :
//   • le remplacement infirmier a DEUX modèles officiels selon que le remplaçant soit un
//     confrère installé ou le titulaire d'une simple autorisation d'exercice ;
//   • l'ASSISTANAT n'existe pas chez les infirmiers — l'Ordre n'en publie aucun modèle, et pour
//     cause : ce statut n'est encadré par aucun texte, contrairement au collaborateur libéral
//     (loi 2005-882 art. 18). Ce n'est pas un modèle manquant, c'est un statut inexistant.
//
// Une liste est NATURELLEMENT PARTIELLE : l'absence d'une entrée se lit comme un fait, là où un
// trou dans une table imbriquée se lit comme un oubli. Elle porte aussi le libellé de chaque
// variante — nécessaire dès qu'on demande à l'utilisateur de choisir — et s'énumère pour dire
// quels types une profession peut publier, ce qui sert le formulaire de création d'annonce.
//
// AJOUTER UNE PROFESSION = ajouter ses entrées ici. Rien d'autre à toucher.
//
// CE REGISTRE NE DÉCRIT PAS LE MOTEUR. Il ne référence aucune fonction de rendu : les gabarits
// sont importés là où le PDF se construit (route de génération), pour que ce module reste
// importable côté client — le formulaire de création d'annonce en a besoin, et il ne doit pas
// tirer @react-pdf/renderer dans le bundle du navigateur.

/** Identifiant stable d'un gabarit. Sert de valeur de choix côté formulaire et de clé de
 *  sélection côté serveur. Déclaré, jamais dérivé d'un libellé : c'est ce qui transite. */
export type GabaritId =
  | "KINE_REMPLACEMENT"
  | "KINE_ASSISTANAT"
  | "KINE_COLLABORATION"
  | "INFIRMIER_REMPLACEMENT_CONFRERE"
  | "INFIRMIER_REMPLACEMENT_AUTORISATION"
  | "INFIRMIER_COLLABORATION";

export interface Gabarit {
  id: GabaritId;
  profession: Profession;
  missionType: MissionType;
  /** Nom du modèle, affiché à l'utilisateur quand plusieurs variantes coexistent. */
  libelle: string;
  /** Ce qui distingue cette variante — vide quand elle est seule pour sa paire. Sert à ce que
   *  le choix soit compréhensible sans connaître le droit de la profession. */
  quandLUtiliser?: string;
  /** Source réglementaire, imprimée en sous-titre du PDF et citée ici pour la traçabilité. */
  source: string;
}

export const GABARITS: Gabarit[] = [
  {
    id: "KINE_REMPLACEMENT",
    profession: Profession.KINESITHERAPEUTE,
    missionType: MissionType.REMPLACEMENT,
    libelle: "Contrat de remplacement libéral",
    source: "CNOMK (28/03/2023)",
  },
  {
    id: "KINE_ASSISTANAT",
    profession: Profession.KINESITHERAPEUTE,
    missionType: MissionType.ASSISTANAT,
    libelle: "Contrat d'assistanat libéral",
    source: "CNOMK (15/11/2024)",
  },
  {
    id: "KINE_COLLABORATION",
    profession: Profession.KINESITHERAPEUTE,
    missionType: MissionType.COLLABORATION,
    libelle: "Contrat de collaboration libérale",
    source: "CNOMK (15/11/2024)",
  },
  {
    id: "INFIRMIER_REMPLACEMENT_CONFRERE",
    profession: Profession.INFIRMIER,
    missionType: MissionType.REMPLACEMENT,
    libelle: "Remplacement — remplaçant installé",
    quandLUtiliser:
      "Le remplaçant a déjà son propre cabinet : il facture avec ses identifiants et verse une redevance au remplacé.",
    source: "CNOI (15/11/2023)",
  },
  {
    id: "INFIRMIER_REMPLACEMENT_AUTORISATION",
    profession: Profession.INFIRMIER,
    missionType: MissionType.REMPLACEMENT,
    libelle: "Remplacement — remplaçant autorisé",
    quandLUtiliser:
      "Le remplaçant n'est pas installé et exerce sous autorisation du conseil de l'Ordre : c'est le remplacé qui perçoit puis reverse.",
    source: "CNOI (15/11/2023)",
  },
  {
    id: "INFIRMIER_COLLABORATION",
    profession: Profession.INFIRMIER,
    missionType: MissionType.COLLABORATION,
    libelle: "Contrat de collaboration libérale",
    source: "CNOI (15/11/2023)",
  },
  // Pas d'entrée INFIRMIER × ASSISTANAT : voir l'en-tête. L'absence est le fait, pas l'oubli.
];

/** Gabarits disponibles pour une paire — 0, 1 ou plusieurs. */
export function gabaritsPour(profession: Profession, missionType: MissionType): Gabarit[] {
  return GABARITS.filter((g) => g.profession === profession && g.missionType === missionType);
}

/** Types de mission qu'une profession peut réellement contractualiser. Consommé par le
 *  formulaire de création d'annonce : proposer un type sans gabarit reviendrait à laisser
 *  publier un poste dont aucun contrat ne pourra sortir. */
export function missionTypesPour(profession: Profession): MissionType[] {
  return Array.from(new Set(GABARITS.filter((g) => g.profession === profession).map((g) => g.missionType)));
}

export function gabaritParId(id: string): Gabarit | undefined {
  return GABARITS.find((g) => g.id === id);
}
