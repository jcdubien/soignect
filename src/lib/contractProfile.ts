// Identité contractuelle (section 150) — champs du Profile requis avant génération d'un
// contrat, injectés dans le PDF. Praticiens (cabinet/remplaçant/assistant) : RPPS + N° Ordre
// + adresse. Structures employeuses : SIRET + adresse. Nom requis pour tous.
// Source unique de vérité, partagée serveur (blocage/PDF) et client (/compte, contrat).

import { libelleNumeroOrdre } from "@/lib/professions";

export interface ContractIdentity {
  name?: string | null;
  adresse?: string | null;
  rpps?: string | null;
  numeroOrdre?: string | null;
  siret?: string | null;
  titulaireKind?: string | null; // "STRUCTURE" ⇒ structure employeuse
  // Profession — elle NOMME le numéro d'ordre (section 287). Facultative : une identité
  // évaluée sans elle retombe sur la formule générique, jamais sur un vocabulaire d'emprunt.
  profession?: string | null;
}

export type ContractField = "name" | "adresse" | "rpps" | "numeroOrdre" | "siret";

export const CONTRACT_FIELD_LABELS: Record<ContractField, string> = {
  // « Nom » et non « Nom complet » : le formulaire de compte intitule ce champ « Nom du cabinet »
  // ou « Votre nom » selon le camp. Réclamer un « Nom complet » envoyait chercher un champ qui
  // n'existe sous ce nom nulle part — signalé le 06/09, captures d'écran à l'appui.
  name:        "Nom",
  adresse:     "Adresse professionnelle",
  rpps:        "N° RPPS",
  // Formule GÉNÉRIQUE, servie seulement quand la profession est inconnue. Le libellé réel se
  // résout par `contractFieldLabel` — voir ci-dessous pourquoi ce champ est le seul à varier.
  numeroOrdre: "N° d'inscription à l'Ordre",
  siret:       "N° SIRET",
};

/**
 * Libellé d'un champ POUR CETTE IDENTITÉ (section 287).
 *
 * ── LE DÉFAUT, TROUVÉ EN PARCOURANT LE PRODUIT EN INFIRMIER ────────────────────────────────
 *
 * L'écran qui bloque la génération du contrat réclamait un « N° d'inscription à l'Ordre ».
 * Le PDF, lui, imprime ce même champ via `libelleNumeroOrdre` — qui rend « **N° ordinal** »
 * pour un infirmier, vocabulaire relevé sur les modèles du CNOI.
 *
 * Même donnée, deux noms : le produit demandait une chose et en imprimait une autre. Invisible
 * tant que tout le monde était kiné, où les deux formulations se confondent.
 *
 * C'est exactement la famille de défauts que la section 240 a fermée — un texte d'écran resté
 * kiné pendant que les gabarits PDF, eux, étaient corrects. Ce morceau-là y avait survécu.
 *
 * ── POURQUOI UNE FONCTION, ET PAS UNE SECONDE TABLE ───────────────────────────────────────
 *
 * Un seul champ varie selon la profession. Dupliquer les cinq libellés par profession aurait
 * fait diverger les quatre qui ne bougent pas. La table reste la source du vocabulaire commun,
 * la fonction n'écarte que ce qui doit l'être — et elle emprunte `libelleNumeroOrdre`, donc
 * l'écran et le PDF lisent désormais LA MÊME déclaration.
 */
export function contractFieldLabel(
  f: ContractField,
  p: Pick<ContractIdentity, "profession">,
): string {
  // Sans profession connue, la formule générique : elle est vraie pour tout le monde, là où
  // le repli de `libelleNumeroOrdre` (« N° Ordre ») est le vocabulaire du CNOMK et parlerait
  // kiné à un infirmier dont on ignore le métier.
  if (f === "numeroOrdre" && p.profession) return libelleNumeroOrdre(p.profession);
  return CONTRACT_FIELD_LABELS[f];
}

/**
 * Les champs à SÉLECTIONNER pour pouvoir évaluer l'identité contractuelle (section 236).
 *
 * POURQUOI CETTE CONSTANTE EXISTE. La liste vivait recopiée à la main dans chaque requête. Celle
 * de la route de signature avait oublié `name` : le champ n'étant pas chargé, il valait
 * `undefined`, et la vérification le déclarait manquant — pour TOUS les profils, y compris ceux
 * dont le nom était rempli. « Nom complet » était donc réclamé sans qu'aucun écran ne puisse le
 * satisfaire, puisque le formulaire l'appelle « Nom du cabinet » et qu'il était déjà renseigné.
 *
 * Une liste de champs recopiée est une liste qui divergera. Elle est déclarée ici, à côté de la
 * fonction qui la consomme, pour que les deux ne puissent plus se contredire.
 */
export const CONTRACT_IDENTITY_SELECT = {
  name: true,
  adresse: true,
  rpps: true,
  numeroOrdre: true,
  siret: true,
  titulaireKind: true,
  // Ajoutée avec la section 287 : sans elle, `contractFieldLabel` ne POUVAIT pas nommer le
  // numéro d'ordre selon le métier — c'est la cause racine du défaut, pas le libellé lui-même.
  profession: true,
} as const;

export function isStructureProfile(p: Pick<ContractIdentity, "titulaireKind">): boolean {
  return p.titulaireKind === "STRUCTURE";
}

// Liste des champs requis pour ce profil (dépend du type structure vs praticien).
export function requiredContractFields(p: Pick<ContractIdentity, "titulaireKind">): ContractField[] {
  const base: ContractField[] = ["name", "adresse"];
  return isStructureProfile(p)
    ? [...base, "siret"]
    : [...base, "rpps", "numeroOrdre"];
}

// Champs requis manquants (vides/espaces) pour ce profil.
export function missingContractFields(p: ContractIdentity): ContractField[] {
  return requiredContractFields(p).filter((f) => {
    const v = p[f];
    return !(typeof v === "string" && v.trim().length > 0);
  });
}

export function isContractProfileComplete(p: ContractIdentity): boolean {
  return missingContractFields(p).length === 0;
}

export function missingContractLabels(p: ContractIdentity): string[] {
  return missingContractFields(p).map((f) => contractFieldLabel(f, p));
}
