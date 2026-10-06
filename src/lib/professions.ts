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
  DENTISTE:         "Chirurgien-dentiste",
  ORTHOPTISTE:      "Orthoptiste",
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
  DENTISTE:         "Chirurgien-dentiste",
  ORTHOPTISTE:      "Orthoptiste",
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
  DENTISTE:         "N° Ordre",
  ORTHOPTISTE:      "N° ADELI",   // les orthoptistes n'ont pas d'ordre : c'est ADELI qui les enregistre
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
  DENTISTE:         "l'Ordre des chirurgiens-dentistes",
  // Pas d'ordre professionnel pour les orthoptistes — la formule neutre n'est pas un repli
  // paresseux ici, c'est le fait.
  ORTHOPTISTE:      "votre autorité d'enregistrement",
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
  DENTISTE:         null,   // aucun gabarit transcrit, donc aucune référence vérifiée
  ORTHOPTISTE:      null,
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

// Forme PLURIELLE, pour les phrases qui nomment une population — « visible par les
// kinésithérapeutes en recherche de poste », le tout premier message qu'un inscrit reçoit.
//
// Cette phrase était codée en dur sur « kinésithérapeutes » dans `lib/camp.ts`. Elle part à
// l'inscription ET dans le courrier de rappel aux inscrits sans publication : à l'ouverture,
// elle aurait annoncé à un chirurgien-dentiste qu'il serait vu par des kinésithérapeutes.
//
// Écrite à la main et NON dérivée de `PROFESSION_LABELS` : « Infirmier·ère » ne se met pas au
// pluriel par concaténation, et « sage-femme » encore moins (« sages-femmes », les deux mots).
// `Record<Profession, string>` impose l'exhaustivité, comme partout ailleurs dans ce fichier.
// Aucun pluriel médical n'est dérivé de MEDECINS : « cardiologues » et « médecins généralistes »
// ne suivent pas la même forme, c'est du contenu, pas de la structure.
export const PROFESSION_PLURIEL: Record<Profession, string> = {
  KINESITHERAPEUTE: "kinésithérapeutes",
  INFIRMIER:        "infirmiers",
  ORTHOPHONISTE:    "orthophonistes",
  SAGE_FEMME:       "sages-femmes",
  DENTISTE:         "chirurgiens-dentistes",
  ORTHOPTISTE:      "orthoptistes",
  MEDECIN_GENERALISTE:    "médecins généralistes",
  MEDECIN_CARDIOLOGIE:    "cardiologues",
  MEDECIN_DERMATOLOGIE:   "dermatologues",
  MEDECIN_ENDOCRINOLOGIE: "endocrinologues",
  MEDECIN_GYNECOLOGIE:    "gynécologues médicaux",
  MEDECIN_OPHTALMOLOGIE:  "ophtalmologues",
  MEDECIN_ORL:            "ORL",
  MEDECIN_PEDIATRIE:      "pédiatres",
  MEDECIN_PSYCHIATRIE:    "psychiatres",
  MEDECIN_RHUMATOLOGIE:   "rhumatologues",
};

export function professionPluriel(p?: string | null): string {
  return PROFESSION_PLURIEL[p as Profession] ?? "professionnels de santé";
}

/**
 * DEUX PROFILS RELÈVENT-ILS DU MÊME MARCHÉ ? (section 278)
 *
 * Pendant de `swipeExploitable` (section 226) sur le second axe de cloisonnement. Le feed borne
 * déjà le fil à la profession du lecteur depuis le 17/08 : un swipe inter-profession ne peut donc
 * plus NAÎTRE. Mais il peut SURVIVRE — `/compte` laisse changer de profession, exactement comme
 * il laissait changer de camp, et les gestes passés restent en base.
 *
 * Le filtre est donc à la LECTURE, pour la même raison qu'en 226 : purger à l'écriture ne
 * réparerait que les bascules futures, et ne détruit rien de ce qui est déjà faux.
 *
 * Sans occurrence à ce jour — les 82 profils sont kinés — et c'est précisément pourquoi il
 * s'écrit maintenant : l'ouverture rend le cas atteignable dès le premier inscrit d'une autre
 * profession, et le défaut n'apparaîtrait qu'au moment où quelqu'un lirait une liste fausse.
 */
export function memeMarche(a?: string | null, b?: string | null): boolean {
  return a === b;
}

// ── GROUPES D'AFFICHAGE (section 278) ────────────────────────────────────────────────────────
//
// Seize entrées à plat dans une liste déroulante se lisent mal, et surtout elles perdent ce
// que l'enum ne peut pas dire : les dix marchés médicaux relèvent du même ordre. Le groupe le
// rend visible sans que l'enum ait à le porter.
//
// Dérivé de MEDECINS pour le groupe médical — ajouter une spécialité la fera apparaître dans la
// liste sans qu'on y pense. Les autres sont énumérés à la main : leur ordre d'affichage est un
// choix (kiné et infirmier d'abord, ce sont les deux professions réellement ouvertes), pas une
// propriété de l'enum.
const GROUPES = [
  { titre: "Rééducation et soins", valeurs: ["KINESITHERAPEUTE", "INFIRMIER", "ORTHOPHONISTE", "ORTHOPTISTE", "SAGE_FEMME"] },
  { titre: "Médecine de ville",    valeurs: MEDECINS },
  { titre: "Dentaire",             valeurs: ["DENTISTE"] },
] as const satisfies readonly { titre: string; valeurs: readonly Profession[] }[];

// ── POURQUOI CETTE GARDE, ET CE QU'ELLE RATTRAPE ────────────────────────────────────────────
//
// Tout le reste de ce fichier est protégé par `Record<Profession, …>` : ajouter une valeur à
// l'enum CASSE la compilation tant que son libellé n'est pas écrit. La liste de groupes, elle,
// n'est qu'un tableau — elle acceptait sans broncher qu'une profession ne figure dans AUCUN
// groupe. Conséquence précise : la profession existe en base, se contractualise peut-être, et
// reste invisible dans la liste déroulante de l'inscription. Personne ne peut la choisir, et
// rien ne le signale.
//
// C'est le défaut que l'ouverture elle-même vient de corriger à l'échelle du produit (une
// colonne qu'aucun écran ne demandait) ; le laisser revenir dans le code qui la demande aurait
// été le reproduire un étage plus bas.
type ProfessionGroupee = (typeof GROUPES)[number]["valeurs"][number];
type ProfessionsOubliees = Exclude<Profession, ProfessionGroupee>;
// Si une profession manque, le type attendu devient un tuple et l'affectation échoue en nommant
// la valeur absente. Pas d'exécution : la garde vit entièrement à la compilation.
const _TOUTES_LES_PROFESSIONS_SONT_GROUPEES: [ProfessionsOubliees] extends [never]
  ? true
  : ["Profession absente de GROUPES_PROFESSION", ProfessionsOubliees] = true;
void _TOUTES_LES_PROFESSIONS_SONT_GROUPEES;

export const GROUPES_PROFESSION: readonly { titre: string; valeurs: readonly Profession[] }[] = GROUPES;
