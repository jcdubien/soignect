// Indicateurs du diagnostic de territoire (23/10) — SOURCE UNIQUE des calculs et des seuils.
// Pur : les données (populations, effectifs) sont chargées ailleurs (lib/recommandationTerritoireServeur).
//
// INDICATIFS. Ce n'est pas un zonage officiel (fixé par l'ARS). Ce que ces chiffres ne voient pas :
// les déplacements entre communes, le temps partiel, la télésanté, les remplaçants. Un praticien est
// compté dans chaque commune où il a une activité déclarée.

/** Densité exprimée pour 10 000 habitants. */
export const PAR_HABITANTS = 10_000;

/** Départements dont la moyenne sert de référence (Guadeloupe ; Saint-Martin et Saint-Barthélemy
 *  sont des collectivités distinctes, exclues de la référence). */
export const DEPARTEMENT_REFERENCE = "971";

export interface Densite {
  effectif: number;
  effectifLiberal: number;
  population: number;
  /** Praticiens pour 10 000 habitants, une décimale. */
  pour10k: number;
  /** Même calcul sur toute la Guadeloupe. */
  reference: number | null;
}

export function pour10k(effectif: number, population: number): number {
  return population > 0 ? Math.round((effectif / population) * PAR_HABITANTS * 10) / 10 : 0;
}

export interface DonneesEffectifs {
  /** Professions présentes dans la source (une profession absente = effectif inconnu, pas zéro). */
  couvertes: string[];
  /** `codeInsee:profession` → effectifs ; une case absente d'une profession couverte vaut 0. */
  parCase: Record<string, { effectif: number; effectifLiberal: number }>;
  population: Record<string, number>;
  /** profession → densité de référence (Guadeloupe). */
  reference: Record<string, number>;
  source: { praticiens: string | null; extraitLe: string | null; population: string | null; millesime: number | null };
}

/** Densité d'un ensemble de communes pour une profession ; null si la profession n'est pas couverte
 *  ou si aucune population n'est connue. */
export function densiteDe(d: DonneesEffectifs, codes: string[], profession: string): Densite | null {
  if (!d.couvertes.includes(profession)) return null;
  let effectif = 0, effectifLiberal = 0, population = 0;
  for (const c of codes) {
    const e = d.parCase[`${c}:${profession}`];
    effectif += e?.effectif ?? 0;
    effectifLiberal += e?.effectifLiberal ?? 0;
    population += d.population[c] ?? 0;
  }
  if (population === 0) return null;
  return { effectif, effectifLiberal, population, pour10k: pour10k(effectif, population), reference: d.reference[profession] ?? null };
}
