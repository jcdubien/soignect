import type { Profession } from "@prisma/client";

// ── LES DIX MARCHÉS MÉDICAUX (section 277) ───────────────────────────────────────────────────
//
// Un généraliste et un ophtalmologue ne se remplacent pas : ce sont deux marchés, donc deux
// valeurs d'enum. Mais ils relèvent du MÊME ordre, du MÊME régime juridique et, le jour venu, du
// MÊME contrat de remplacement.
//
// Ce qui leur est PROPRE s'écrit (le libellé du marché) ; ce qui leur est COMMUN se DÉRIVE.
// Écrire « l'Ordre des médecins » dix fois aurait été la recopie que ce dépôt a déjà payée
// quatre fois — et il aurait suffi d'en corriger neuf pour que la dixième mente.
export const MEDECINS = [
  "MEDECIN_GENERALISTE",
  "MEDECIN_CARDIOLOGIE",
  "MEDECIN_DERMATOLOGIE",
  "MEDECIN_ENDOCRINOLOGIE",
  "MEDECIN_GYNECOLOGIE",
  "MEDECIN_OPHTALMOLOGIE",
  "MEDECIN_ORL",
  "MEDECIN_PEDIATRIE",
  "MEDECIN_PSYCHIATRIE",
  "MEDECIN_RHUMATOLOGIE",
] as const satisfies readonly Profession[];

export type ProfessionMedecin = (typeof MEDECINS)[number];

export function estMedecin(p?: string | null): boolean {
  return (MEDECINS as readonly string[]).includes(p ?? "");
}

/** La même valeur pour les dix marchés médicaux — une seule écriture, dix entrées. */
function pourTousLesMedecins<T>(valeur: T): Record<ProfessionMedecin, T> {
  return Object.fromEntries(MEDECINS.map((m) => [m, valeur])) as Record<ProfessionMedecin, T>;
}

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
  // Le libellé du MARCHÉ : c'est lui qui distingue, donc il s'écrit.
  MEDECIN_GENERALISTE:    "Médecin généraliste",
  MEDECIN_CARDIOLOGIE:    "Cardiologue",
  MEDECIN_DERMATOLOGIE:   "Dermatologue",
  MEDECIN_ENDOCRINOLOGIE: "Endocrinologue",
  MEDECIN_GYNECOLOGIE:    "Gynécologue médical·e",
  MEDECIN_OPHTALMOLOGIE:  "Ophtalmologue",
  MEDECIN_ORL:            "ORL",
  MEDECIN_PEDIATRIE:      "Pédiatre",
  MEDECIN_PSYCHIATRIE:    "Psychiatre",
  MEDECIN_RHUMATOLOGIE:   "Rhumatologue",
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
  // NON VÉRIFIÉ AUPRÈS DU CNOM : aucun gabarit médecin n'est transcrit, donc aucune de ces
  // valeurs n'est imprimée nulle part aujourd'hui. Forme descriptive, à confronter au modèle
  // de l'Ordre le jour où le premier contrat médecin sera écrit.
  MEDECIN_GENERALISTE:    "Médecin généraliste",
  MEDECIN_CARDIOLOGIE:    "Médecin spécialiste en cardiologie",
  MEDECIN_DERMATOLOGIE:   "Médecin spécialiste en dermatologie",
  MEDECIN_ENDOCRINOLOGIE: "Médecin spécialiste en endocrinologie",
  MEDECIN_GYNECOLOGIE:    "Médecin spécialiste en gynécologie médicale",
  MEDECIN_OPHTALMOLOGIE:  "Médecin spécialiste en ophtalmologie",
  MEDECIN_ORL:            "Médecin spécialiste en oto-rhino-laryngologie",
  MEDECIN_PEDIATRIE:      "Médecin spécialiste en pédiatrie",
  MEDECIN_PSYCHIATRIE:    "Médecin spécialiste en psychiatrie",
  MEDECIN_RHUMATOLOGIE:   "Médecin spécialiste en rhumatologie",
};

// Intitulé du NUMÉRO D'INSCRIPTION À L'ORDRE, qui change de nom d'une profession à l'autre.
// Le CNOMK écrit « N° Ordre », le CNOI « n° ordinal » — même donnée, deux vocabulaires. Porté
// ici comme PROFESSION_LABELS_CONTRAT et pour la même raison : un contrat emploie les mots de
// l'ordre qui le régit, pas ceux du produit.
//
// `Record<Profession, string>` impose l'exhaustivité : ajouter une profession à l'enum casse la
// compilation tant que son intitulé n'est pas écrit. Les valeurs non vérifiées auprès de leur
// ordre reprennent la forme générique — ce n'est pas une supposition, c'est le libellé neutre.
export const LIBELLE_NUMERO_ORDRE: Record<Profession, string> = {
  KINESITHERAPEUTE: "N° Ordre",      // inchangé : c'est déjà ce qu'impriment les gabarits CNOMK
  INFIRMIER:        "N° ordinal",    // vocabulaire du CNOI, relevé sur ses modèles de contrat
  ORTHOPHONISTE:    "N° Ordre",
  SAGE_FEMME:       "N° Ordre",
  // Dérivé : un seul ordre pour les dix marchés, donc un seul vocabulaire.
  ...pourTousLesMedecins("N° Ordre"),
};

export function libelleNumeroOrdre(p?: string | null): string {
  return LIBELLE_NUMERO_ORDRE[p as Profession] ?? "N° Ordre";
}

// Nom de l'ORDRE PROFESSIONNEL, tel qu'on l'écrit à un praticien (section 240).
//
// L'écran de contrat renvoyait tout le monde vers « l'Ordre des masseurs-kinésithérapeutes »,
// texte codé en dur. Sur un contrat infirmier, cela nommait le mauvais ordre — un énoncé faux
// sur un écran juridique, dans la même famille que tout ce que la section 237 a fermé.
//
// Les gabarits PDF, eux, étaient corrects : chacun porte les références de son propre ordre.
// Seule la coquille de l'écran était restée kiné.
export const LIBELLE_ORDRE: Record<Profession, string> = {
  KINESITHERAPEUTE: "l'Ordre des masseurs-kinésithérapeutes",
  INFIRMIER:        "l'Ordre des infirmiers",
  ORTHOPHONISTE:    "votre ordre professionnel",  // pas de gabarit à ce jour
  SAGE_FEMME:       "l'Ordre des sages-femmes",
  // Dérivé : c'est exactement ce que la scission ne doit PAS recopier dix fois.
  ...pourTousLesMedecins("l'Ordre des médecins"),
};

export function libelleOrdre(p?: string | null): string {
  return LIBELLE_ORDRE[p as Profession] ?? "votre ordre professionnel";
}

// Article du code de la santé publique fondant la clause de NON-INSTALLATION après remplacement.
//
// La durée de deux ans est la même d'une profession à l'autre, mais PAS le numéro d'article :
// R.4321-130 pour les masseurs-kinésithérapeutes, R.4312-87 pour les infirmiers. L'écran citait
// le premier à tout le monde.
//
// `null` PLUTÔT QU'UNE SUPPOSITION. Pour les professions dont aucun gabarit n'est transcrit, je
// n'ai pas de référence vérifiée. Inventer un numéro d'article serait exactement le défaut qu'on
// corrige ici : l'écran omet alors la citation et se contente de la durée, qui, elle, est sûre.
export const ARTICLE_NON_INSTALLATION: Record<Profession, string | null> = {
  KINESITHERAPEUTE: "R.4321-130",   // relevé sur le modèle CNOMK transcrit
  INFIRMIER:        "R.4312-87",    // relevé sur le modèle CNOI transcrit
  ORTHOPHONISTE:    null,
  SAGE_FEMME:       null,
  // Dérivé à `null`, et c'est la règle du fichier : pas de gabarit médecin transcrit, donc
  // aucune référence vérifiée. Inventer un numéro d'article serait le défaut qu'on corrige ici.
  ...pourTousLesMedecins(null),
};

export function articleNonInstallation(p?: string | null): string | null {
  return ARTICLE_NON_INSTALLATION[p as Profession] ?? null;
}

// La valeur vient de la base : elle est typée Profession côté Prisma, mais transite en string
// dans les routes. Le repli conserve la valeur brute plutôt que de masquer une incohérence.
export function professionLabel(p: string, registre: "usuel" | "contrat" = "usuel"): string {
  const table = registre === "contrat" ? PROFESSION_LABELS_CONTRAT : PROFESSION_LABELS;
  return table[p as Profession] ?? p;
}
