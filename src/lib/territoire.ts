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
// D'OÙ VIENT LE CHIFFRE — et pourquoi ce n'est plus `CommuneAPL.boost*` (19/08, B3).
//
// Ce module a d'abord lu `CommuneAPL.boost*` (−10..+10, une colonne par profession, éditable
// dans /admin/apl). On a mesuré le 18/08 que ces valeurs n'étaient DÉCLARÉES PAR PERSONNE : les
// 112 lignes portent un `updatedAt` identique à la milliseconde (28/06/2026 18:16:37.780), et
// la colonne est `@updatedAt` — une seule saisie en aurait décalé une. Aucune ne l'est. Les
// valeurs viennent de l'import initial et suivent l'indicateur APL de la DREES (boost 3 ↔ apl 0,
// boost 2 ↔ apl ≤ 166, boost 1 ↔ apl ≤ 203,7), uniformément sur les quatre départements.
//
// LE DÉFAUT N'ÉTAIT PAS LA VALEUR, C'ÉTAIT LE SUPPORT. Un entier nu ne dit ni qui a déclaré, ni
// quand, ni sur quelle base : rien dans `boostKine = 2` ne distingue un jugement de santé
// publique d'un résultat de calcul. Toute phrase attribuant ce 2 à une institution était donc
// invérifiable par construction — c'est ce qui a produit deux affirmations fausses d'affilée
// (979ccd8, puis la mention « par sa CPTS » retirée le 18/08).
//
// `PrioriteTerritoriale` est le support qui peut porter la vérité : aucune ligne n'existe sans
// nommer son institution, sa date et l'administrateur qui l'a co-saisie. C'est ce qui autorisera
// la mention à revenir (B2), adossée à une ligne qu'on peut montrer.
//
// CONTREPARTIE ASSUMÉE : la table démarre vide, donc le levier est INERTE jusqu'à la première
// déclaration réelle. Amorcer la table depuis les 56 communes à `boost != 0` aurait fabriqué 56
// déclarations que personne n'a faites — la faute exacte qu'on répare. `boost*` reste éditable
// dans /admin/apl et n'est plus lue par aucune logique produit ; ce qu'on en fait est une
// question ouverte, pas un oubli.
//
// ── GATING PAR RELATION CLIENT (19/08) ───────────────────────────────────────────────────────
//
// Une déclaration ne suffit PAS à activer le levier : il faut aussi que l'institution qui la
// porte ait une relation client active (`ClientInstitutionnel`). Principe ferme du 19/08
// (STRATEGIE_MARKETING_BUSINESS.md §4) : le levier territorial est un service institutionnel
// vendu — PoC gratuit aujourd'hui, client payant demain. S'il s'appliquait dès qu'une valeur
// existe en base, le produit distribuerait gratuitement ce qu'il est censé vendre.
//
// C'est la troisième fois que la même faute se présente sous un autre visage, et c'est ce qui
// justifie de ne pas la traiter par un simple drapeau :
//   1. `boost*` agissait sans que personne ne l'ait déclaré  → B3 a créé un support pour l'auteur.
//   2. `institution` était du texte libre : « CPTS Nord Basse-Terre » et « test » se valaient
//      → cette version la remplace par une relation qu'on peut vérifier.
//   3. Un statut nu (« client actif : oui ») aurait affirmé une relation sans pouvoir la
//      prouver → `ClientInstitutionnel` porte la nature, le début et l'échéance de revue.
// À chaque étape, le correctif consiste à donner au support la capacité de porter ce qu'on lui
// fait dire — jamais à ajouter un champ qui l'affirme.

import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { inseeOfCommune } from "@/lib/communes";

// ── Dosage ───────────────────────────────────────────────────────────────────
//
// Le niveau déclaré est un entier 1..10. La désirabilité est un pourcentage 0-100 et le bonus
// saisonnier vaut 30. Un niveau ajouté tel quel serait noyé : un 2 sur Deshaies ne déplacerait
// rien face à un palier Premium de 50. Il faut donc une échelle, et la choisir est un
// arbitrage, pas un détail d'implémentation.
//
// FACTEUR 3 → l'amplitude maximale vaut +30, soit exactement le bonus saisonnier, et reste
// sous le palier Premium (50). Ce qui se dit en une phrase défendable devant une CPTS ET
// devant un abonné : une commune déclarée prioritaire au maximum pèse autant que la fenêtre de
// tension du territoire, et jamais autant qu'un abonnement payé.
//
// L'ÉCHELLE EST DEVENUE POSITIVE (19/08). `boost*` allait de −10 à +10 ; le niveau déclaré va
// de 1 à 10. Une institution déclare qu'il MANQUE des soignants quelque part — elle ne déclare
// pas qu'une commune mérite d'être enfoncée dans le classement. Le négatif n'était pas un
// réglage plus fin, c'était une capacité dont personne n'a jamais su quoi faire.
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
// La table de correspondance profession → colonne `boost*` qui vivait ici a été RETIRÉE le
// 19/08 avec le branchement de `PrioriteTerritoriale` : la profession est maintenant une
// colonne de la table des déclarations, donc une valeur de `where`, plus un nom de champ à
// choisir. La règle « déclaré, pas dérivé » qu'elle illustrait reste vraie ailleurs
// (`Profession.enumBase`, `COMMUNE_INSEE`, slug d'URL) — c'est le besoin qui a disparu, pas
// la règle.

/** Convertit un niveau déclaré (1..10) en points d'ordre (3..30). Pure, testable seule. */
export function bonusTerritorial(niveau: number | null | undefined): number {
  if (!niveau || niveau <= 0) return 0;
  return Math.min(niveau, 10) * FACTEUR_PRIORITE_TERRITORIALE;
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
 * Les communes sans code INSEE (Grand Case n'est pas une commune) rendent simplement 0. Une
 * absence de déclaration n'est pas une anomalie : c'est le cas normal d'un territoire dont
 * personne n'a rien dit — et depuis le 19/08, c'est le cas de TOUS les territoires, la table
 * des déclarations démarrant vide.
 *
 * ELLE LIT `PrioriteTerritoriale`, PLUS `CommuneAPL.boost*` (19/08). Les `boost*` ne portaient
 * aucune déclaration : ils dérivaient de l'indicateur APL et personne ne les avait jamais
 * saisis. Continuer à les lire aurait fait agir un calcul sous le nom d'un jugement
 * institutionnel. La contrepartie est assumée : le levier est inerte tant qu'aucune institution
 * n'a déclaré, ce qui est exactement ce qu'il doit valoir.
 *
 * Le périmètre n'est plus celui de `CommuneAPL` : Saint-Martin et Saint-Barthélemy (977/978),
 * absents de la table APL depuis leur séparation de la Guadeloupe en 2007, PEUVENT désormais
 * porter une déclaration. Une institution n'a pas à être privée de parole parce que la DREES ne
 * publie pas d'APL chez elle.
 */
export interface PrioriteAppliquee {
  /** Points d'ordre, déjà convertis par `bonusTerritorial`. */
  points: number;
  /** Nom de l'institution qui a déclaré — porté jusqu'ici pour que la mention de transparence
   *  puisse la NOMMER (B2, 20/08). C'est toute la différence avec les deux versions fausses
   *  précédentes : la phrase affichée s'adosse à une ligne qu'on peut montrer. */
  institution: string;
}

export async function chargerPrioritesTerritoriales(
  communes: (string | null | undefined)[],
  profession: Profession,
  maintenant: Date = new Date(),
): Promise<Map<string, PrioriteAppliquee>> {
  const parCode = new Map<string, string[]>();

  for (const commune of communes) {
    const code = inseeOfCommune(commune);
    if (!code || !commune) continue;
    // Plusieurs libellés peuvent partager un code (Marigot et Grand Case pointent tous deux
    // sur Saint-Martin) : on garde la liste, sans quoi l'un des deux perdrait sa priorité.
    parCode.set(code, [...(parCode.get(code) ?? []), commune]);
  }

  const resultat = new Map<string, PrioriteAppliquee>();
  if (parCode.size === 0) return resultat;

  // DEUX CONDITIONS INDÉPENDANTES, toutes deux filtrées EN SQL — une déclaration écartée ne doit
  // pas même remonter, sans quoi le prochain lecteur du code croira qu'elle compte.
  //
  //  1. LA DÉCLARATION est vivante : `expireLe` nul (sans échéance déclarée) ou à venir. Le
  //     `null` doit passer — un `lt` seul les écarterait toutes, piège classique du NULL en SQL.
  //  2. LA RELATION CLIENT est active : non close, et dans son intervalle de revue. C'est le
  //     gating du 19/08 : sans lui, le levier s'appliquerait dès qu'une ligne existe, et le
  //     produit distribuerait gratuitement ce qu'il vend comme service institutionnel.
  //
  // `revueLe` DÉPASSÉE ÉTEINT LE LEVIER, elle ne se contente pas de signaler. C'est le seul sens
  // possible de « jamais silencieusement permanent » : si le boost continuait de courir après
  // l'échéance, la revue ne serait qu'un post-it que personne n'est obligé de lire. L'extinction
  // est le défaut, la reconduction un geste explicite.
  const lignes = await prisma.prioriteTerritoriale.findMany({
    where: {
      codeInsee: { in: Array.from(parCode.keys()) },
      profession,
      OR: [{ expireLe: null }, { expireLe: { gt: maintenant } }],
      client: {
        clotureLe: null,
        debutLe: { lte: maintenant },
        revueLe: { gt: maintenant },
      },
    },
    select: { codeInsee: true, niveau: true, client: { select: { nom: true } } },
  });

  for (const ligne of lignes) {
    const points = bonusTerritorial(ligne.niveau);
    if (points === 0) continue;
    for (const libelle of parCode.get(ligne.codeInsee) ?? []) {
      resultat.set(libelle, { points, institution: ligne.client.nom });
    }
  }
  return resultat;
}
