// Seuils de la mesure territoriale (point 10) — pur, lisible côté client. La logique est dans
// lib/mesureTerritoriale.

/** Aucun chiffre affiché en dessous de ce seuil. */
export const SEUIL_AGREGATION = 5;
/** Délai avant toute lecture des résultats. « Plusieurs mois » : 6, à confirmer par JC. */
export const DELAI_LECTURE_MOIS = 6;
/** Première trace instrumentée par client (livraison du point 10). */
export const DEBUT_MESURE = new Date("2026-10-22T00:00:00Z");

export interface LigneMesure {
  mois: string; // AAAA-MM
  servies: number | null;
  remontees: number | null;
  interets: number | null;
  misesEnRelation: number | null;
}
