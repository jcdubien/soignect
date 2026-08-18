// Priorité territoriale déclarée — mise en avant des annonces d'une commune (section 214).
//
// CE QUE C'EST, ET CE QUE ÇA N'EST PAS
// Une CPTS constate qu'il manque des soignants sur telle commune de son territoire. Elle le
// déclare, et les annonces de cette commune remontent dans l'ORDRE D'AFFICHAGE du feed. C'est
// un jugement de santé publique porté par une institution, pas une mesure du produit — et
// surtout pas une propriété de l'accord entre deux personnes.
//
// À ce titre, elle vit exactement où vit la désirabilité commerciale : dans l'ordre, jamais
// dans `computeAffinityScore`. La discipline posée le 03/08 (désirabilité sortie du score) vaut
// telle quelle ici. Un score présenté comme une compatibilité ne doit affirmer que ce qu'il
// mesure, et « cette commune manque de kinés » ne dit rien de la compatibilité entre un cabinet
// et un remplaçant.
//
// LA DONNÉE EXISTAIT DÉJÀ, ET NE FAISAIT RIEN. `CommuneAPL.boost*` (−10 à +10, une colonne par
// profession) est éditable dans /admin/apl depuis longtemps, et 56 des 112 communes en portent
// une valeur non nulle — dont trois des quatre communes de Nord Basse-Terre. Aucune logique
// produit ne la lisait. L'écran invitait donc à régler un curseur sans effet, pendant que le
// feed affirmait à l'utilisateur que ce curseur agissait (mention « zones prioritaires »,
// retirée le 17/08 faute d'être vraie). Ce module lit enfin la colonne.
//
// ⚠️ MAIS CE QUE LA COLONNE CONTIENT N'EST PAS UNE DÉCLARATION — mesuré le 18/08, contre ce que
// la version précédente de ce commentaire laissait entendre. Les 112 lignes portent un
// `updatedAt` identique à la milliseconde (28/06/2026 18:16:37.780) ; la colonne est `@updatedAt`,
// donc UNE seule saisie dans /admin/apl aurait décalé sa ligne. Aucune ne l'est : personne n'a
// jamais touché ces curseurs. Les valeurs viennent de l'import initial et suivent l'indicateur
// APL de la DREES — boost 3 ↔ apl 0, boost 2 ↔ apl ≤ 166, boost 1 ↔ apl ≤ 203,7 — réparties
// uniformément sur les quatre départements (16/32, 17/34, 11/22, 12/24).
//
// CONSÉQUENCE, ET ELLE EST STRUCTURANTE : ce module met en avant une DÉRIVATION D'UN INDICATEUR
// NATIONAL, pas un jugement porté par une institution locale. Le comportement est défendable
// (une commune sous-dotée mérite d'être montrée), le RÉCIT ne l'est pas — c'est pourquoi la
// mention affichée aux candidats ne nomme plus d'auteur.
//
// `boost*` ne peut pas non plus DEVENIR le canal de déclaration : elle est déjà occupée par une
// valeur dérivée, et une colonne qui mélange les deux rend une déclaration indistinguable d'un
// calcul. C'est le manque n°3 déjà nommé sur `CommuneAPL` (donnée externe et réglage maison
// cohabitent sans rien qui les distingue). Une CPTS qui déclare écrit ailleurs.

import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { inseeOfCommune } from "@/lib/communes";

// ── Dosage ───────────────────────────────────────────────────────────────────
//
// Le boost brut est un entier −10..+10. La désirabilité est un pourcentage 0-100 et le bonus
// saisonnier vaut 30. Un boost brut ajouté tel quel serait noyé : +2 sur Deshaies ne
// déplacerait rien face à un palier Premium de 50. Il faut donc une échelle, et la choisir est
// un arbitrage, pas un détail d'implémentation.
//
// FACTEUR 3 → l'amplitude maximale vaut ±30, soit exactement le bonus saisonnier, et reste
// sous le palier Premium (50). Ce qui se dit en une phrase défendable devant une CPTS ET
// devant un abonné : une commune déclarée prioritaire au maximum pèse autant que la fenêtre de
// tension du territoire, et jamais autant qu'un abonnement payé.
//
// Le jour où ce dosage se rediscute, c'est cette constante qu'on change — pas la logique.
export const FACTEUR_PRIORITE_TERRITORIALE = 3;

// ── ARBITRAGE isFounding (100) CONTRE LEVIER INSTITUTIONNEL (±30) — tranché le 18/08 ─────────
//
// LA QUESTION POSÉE. Une commune déclarée prioritaire ne peut jamais faire remonter une annonce
// au-dessus de celles du cabinet fondateur (100 fixe). Fallait-il remonter le facteur ?
//
// RÉPONSE : NON, et le dosage n'est pas le sujet. Le vrai défaut est que ces deux nombres
// s'additionnent sur UN SEUL AXE alors qu'ils sont de deux natures :
//   • la désirabilité est une ÉCHELLE DE RANG commerciale — Gratuit 0, Premium/Structure 50,
//     Boost 80, Fondateur 100. Ce sont des paliers : qui paie, qui possède.
//   • le saisonnier (+30) et le territorial (±30) sont des MODULATIONS — ils décrivent une
//     tension du terrain, pas un statut d'annonceur.
// Les sommer oblige chaque nouveau levier à se doser contre le tarif. C'est ce qui a produit la
// fausse alternative : « trahir l'abonné » ou « un levier inerte ». Les deux branches sont
// mauvaises parce que la question l'est.
//
// LA FORME JUSTE est un tri lexicographique — rang commercial d'abord, modulations ensuite au
// sein du rang. Aucun levier gratuit ne passe alors devant un abonnement payé, quel que soit son
// dosage, et cette constante cesse de porter une signification commerciale qu'elle n'aurait
// jamais dû porter.
//
// ELLE N'EST PAS IMPLÉMENTÉE AUJOURD'HUI, ET C'EST LE POINT. Elle protégerait un levier
// institutionnel qui n'existe pas encore : la colonne lue ici ne contient aucune déclaration
// (voir l'en-tête). Écrire ce tri maintenant serait de l'architecture à vide — la même règle qui
// garde `FENETRE_TENSION_GUADELOUPE` en constante plutôt qu'en table. Le déclencheur est nommé :
// le jour où une institution écrit vraiment dans le produit, c'est le tri qu'on change, pas ce 3.

// ── Quelle colonne pour quelle profession ────────────────────────────────────
//
// DÉCLARÉ, PAS DÉRIVÉ — quatrième application de la règle après le slug d'URL (14/08),
// `Profession.enumBase` et `COMMUNE_INSEE` (17/08). Les noms de colonnes ne suivent aucune
// règle mécanique tirable de l'enum : `KINESITHERAPEUTE` → `boostKine` (abrégé),
// `SAGE_FEMME` → `boostSageFemme` (casse changée). Une dérivation automatique marcherait sur
// trois des cinq et casserait en silence sur les deux autres.
const COLONNE_BOOST: Record<Profession, "boostKine" | "boostInfirmier" | "boostMedecin" | "boostSageFemme" | "boostOrthophoniste"> = {
  KINESITHERAPEUTE: "boostKine",
  INFIRMIER:        "boostInfirmier",
  MEDECIN:          "boostMedecin",
  SAGE_FEMME:       "boostSageFemme",
  ORTHOPHONISTE:    "boostOrthophoniste",
};

/** Convertit un boost brut (−10..+10) en points d'ordre (−30..+30). Pure, testable seule. */
export function bonusTerritorial(boostBrut: number | null | undefined): number {
  if (!boostBrut) return 0;
  return Math.min(Math.max(boostBrut, -10), 10) * FACTEUR_PRIORITE_TERRITORIALE;
}

/**
 * Charge les priorités déclarées pour un ensemble de communes, dans la profession donnée.
 *
 * Rend une Map LIBELLÉ PRODUIT → points d'ordre, déjà convertis. L'appelant n'a donc jamais à
 * manipuler ni code INSEE ni nom de colonne : tout le pont (section 213) est absorbé ici.
 *
 * UNE SEULE REQUÊTE, quel que soit le nombre d'annonces — le feed en sert jusqu'à 50 et ne peut
 * pas se permettre une lecture par ligne.
 *
 * Les communes sans code INSEE (Grand Case n'est pas une commune) et celles hors périmètre APL
 * (Saint-Martin, Saint-Barthélemy — départements 977/978 absents de `CommuneAPL` depuis leur
 * séparation de la Guadeloupe en 2007) rendent simplement 0. Une absence de déclaration n'est
 * pas une anomalie : c'est le cas normal d'un territoire dont personne n'a rien dit.
 */
export async function chargerPrioritesTerritoriales(
  communes: (string | null | undefined)[],
  profession: Profession,
): Promise<Map<string, number>> {
  const colonne = COLONNE_BOOST[profession];
  const parCode = new Map<string, string[]>();

  for (const commune of communes) {
    const code = inseeOfCommune(commune);
    if (!code || !commune) continue;
    // Plusieurs libellés peuvent partager un code (Marigot et Grand Case pointent tous deux
    // sur Saint-Martin) : on garde la liste, sans quoi l'un des deux perdrait sa priorité.
    parCode.set(code, [...(parCode.get(code) ?? []), commune]);
  }

  const resultat = new Map<string, number>();
  if (parCode.size === 0) return resultat;

  // Les CINQ colonnes sont sélectionnées, puis la bonne est choisie en mémoire. Un `select`
  // dynamique aurait forcé un cast qui désactive la vérification de types précisément là où
  // elle sert : un nom de colonne erroné passerait à la compilation et rendrait 0 en silence.
  // Cinq entiers sur au plus 50 lignes ne coûtent rien.
  const lignes = await prisma.communeAPL.findMany({
    where: { codeInsee: { in: Array.from(parCode.keys()) } },
    select: {
      codeInsee: true,
      boostKine: true, boostInfirmier: true, boostMedecin: true,
      boostSageFemme: true, boostOrthophoniste: true,
    },
  });

  for (const ligne of lignes) {
    const points = bonusTerritorial(ligne[colonne]);
    if (points === 0) continue;
    for (const libelle of parCode.get(ligne.codeInsee) ?? []) resultat.set(libelle, points);
  }
  return resultat;
}
