import { MissionType, Profession } from "@prisma/client";

// Registre des gabarits de CONTRAT DE TRAVAIL (section 217) — distinct du registre libéral.
//
// POURQUOI UN REGISTRE SÉPARÉ, ET PAS UNE VALEUR DE PLUS DANS MissionType
// Recensement du 29/08 : 43 fichiers lisent `MissionType`, et **aucun** ne l'énumère
// exhaustivement — pas un seul `Record<MissionType, …>` dans le dépôt. Les décisions se prennent
// en ternaires et en chaînes `if/else` terminées par un `else`. Ajouter `SALARIE` à l'enum aurait
// donc compilé partout en silence, et une valeur inconnue serait retombée dans la branche par
// défaut. Trois conséquences mesurées :
//   • la génération de contrat serait sortie un `buildCollaborationPdf` — un contrat de
//     collaboration LIBÉRALE pour un contrat de travail, faux et signé ;
//   • `socleFor` aurait appliqué le barème remplacement ET renvoyé le label « REMPLACEMENT »,
//     que les scoreDetails en base auraient conservé ;
//   • `annonceAI` code les trois valeurs dans le prompt envoyé au modèle : sans mise à jour, la
//     valeur n'aurait jamais été extraite.
//
// La bifurcation existe déjà dans le produit — `TitulaireKind.STRUCTURE`, dont `isEmployeur`
// dérive, fait déjà basculer le vocabulaire des formulaires et bloque la génération de PDF
// depuis la section 161. On la branche, on ne l'invente pas.

/** Nature du contrat de travail. Le sous-cas du CDD — terme précis ou non — ne se déduit pas du
 *  `MissionType` : il se tranche à la génération, comme la variante de remplacement infirmier
 *  (décision du 27/08). Ce registre ne porte donc que la distinction CDI / CDD. */
export type NatureContratTravail = "CDI" | "CDD";

// ── La superposition, rendue explicite ────────────────────────────────────────
//
// Un même `MissionType` désigne DEUX CHOSES OPPOSÉES selon le camp de l'annonceur :
//
//   COLLABORATION + cabinet libéral → « Collaboration »  (engagement libéral, redevance)
//   COLLABORATION + structure       → « CDI »            (contrat de travail, subordination)
//
// Cette superposition est héritée : le formulaire de publication relabelle déjà les trois types
// en Vacation / CDD / CDI pour un employeur, mais la valeur stockée reste la même. La
// correspondance vivait donc dans un ternaire de LIBELLÉS, où rien ne disait qu'elle décidait
// aussi de la nature juridique du contrat.
//
// Elle est déclarée ici plutôt que dupliquée. Pas de colonne dédiée : elle serait nulle pour
// toutes les annonces libérales et devrait être tenue en cohérence à chaque écriture — soit
// exactement la définition du levier dormant, dont le produit compte déjà quatre exemplaires.
//
// ⚠️ CE QUE CETTE FORME NE RÉSOUT PAS. Une requête `missionType = COLLABORATION` continue de
// mélanger collaborations libérales et CDI salariés. La dérivation rend l'interprétation lisible ;
// elle ne désambiguïse PAS la base. Compter ou filtrer les CDI demandera de joindre sur
// `titulaireKind`.
//
// Le `Record` impose l'exhaustivité : si `MissionType` gagne une valeur, la compilation casse ici.
export const NATURE_PAR_MISSION: Record<MissionType, NatureContratTravail> = {
  [MissionType.COLLABORATION]: "CDI", // affiché « CDI » — contrat long terme
  [MissionType.ASSISTANAT]:    "CDD", // affiché « CDD » — contrat moyen terme
  [MissionType.REMPLACEMENT]:  "CDD", // affiché « Vacation » — un CDD court
};

export type GabaritSalarieId =
  | "KINE_SALARIAT_CDI"
  | "KINE_SALARIAT_CDD"
  | "INFIRMIER_SALARIAT_CDI"
  | "INFIRMIER_SALARIAT_CDD";

export interface GabaritSalarie {
  id: GabaritSalarieId;
  profession: Profession;
  nature: NatureContratTravail;
  libelle: string;
  /** Source réglementaire, imprimée en sous-titre du PDF. Le CDI kiné n'en a pas : voir
   *  `composeSansModele`. */
  source: string;
  /** Vrai quand AUCUN modèle-type d'ordre ne couvre ce cas et que le document a été composé.
   *  Sert à afficher un avertissement renforcé à l'écran, en plus de celui du PDF. */
  composeSansModele?: boolean;
}

export const GABARITS_SALARIE: GabaritSalarie[] = [
  {
    id: "KINE_SALARIAT_CDI",
    profession: Profession.KINESITHERAPEUTE,
    nature: "CDI",
    libelle: "Contrat de travail à durée indéterminée",
    source: "Composé — aucun modèle CNOMK pour ce cas",
    composeSansModele: true,
  },
  // KINE_SALARIAT_CDD, INFIRMIER_SALARIAT_CDI et INFIRMIER_SALARIAT_CDD : gabarits non encore
  // écrits. Leur absence est un fait constaté, pas un oubli — la route refuse explicitement
  // plutôt que de retomber sur un autre gabarit.
];

export function gabaritsSalariePour(
  profession: Profession,
  nature: NatureContratTravail,
): GabaritSalarie[] {
  return GABARITS_SALARIE.filter((g) => g.profession === profession && g.nature === nature);
}

export function gabaritSalarieParId(id: string): GabaritSalarie | undefined {
  return GABARITS_SALARIE.find((g) => g.id === id);
}
