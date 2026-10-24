// Indicateurs du diagnostic de territoire (23/10) — SOURCE UNIQUE des calculs et des seuils.
// Pur : les données (populations, effectifs) sont chargées ailleurs (lib/recommandationTerritoireServeur).
//
// INDICATIFS. Ce n'est pas un zonage officiel (fixé par l'ARS). Ce que ces chiffres ne voient pas :
// les déplacements entre communes, le temps partiel, la télésanté, les remplaçants. Un praticien est
// compté dans chaque commune où il a une activité déclarée.
//
// LA DENSITÉ PORTE SUR LES LIBÉRAUX (23/10, remarque de JC). Compter tous les praticiens mesurait
// surtout les hôpitaux : un établissement compte son personnel salarié dans sa commune. Mesuré le
// 23/10 pour les infirmiers : Pointe-Noire (hôpital Beauperthuy) 111 pour 10 000 en total contre 35
// en libéral ; Les Abymes (CHU) 215 contre 28 ; Guadeloupe 92 contre 30. Pour l'accès aux soins de
// ville — la question d'une CPTS — c'est l'exercice libéral qui compte. Le total reste affiché à
// côté, et la règle « aucune activité déclarée » s'appuie sur lui (une consultation hospitalière
// est une offre réelle).

/** Densité exprimée pour 10 000 habitants. */
export const PAR_HABITANTS = 10_000;

/** Départements dont la moyenne sert de référence (Guadeloupe ; Saint-Martin et Saint-Barthélemy
 *  sont des collectivités distinctes, exclues de la référence). */
export const DEPARTEMENT_REFERENCE = "971";

export interface Densite {
  effectif: number;
  effectifLiberal: number;
  population: number;
  /** Praticiens LIBÉRAUX pour 10 000 habitants, une décimale. */
  pour10k: number;
  /** Même calcul (libéraux) sur toute la Guadeloupe. */
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
  /** profession → densité de référence des libéraux (Guadeloupe). */
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
  return { effectif, effectifLiberal, population, pour10k: pour10k(effectifLiberal, population), reference: d.reference[profession] ?? null };
}

/** Territoire de référence du rang APL (le rang est calculé dans le département de la commune). */
export function territoireDuCode(codeInsee: string | null): string {
  const d = (codeInsee ?? "").slice(0, 3);
  return d === "971" ? "en Guadeloupe" : d === "972" ? "en Martinique" : d === "973" ? "en Guyane" : d === "974" ? "à La Réunion" : "dans le département";
}

/** « la 3ᵉ commune la moins bien dotée sur 32 en Guadeloupe » (rang 1 = accès le plus faible). */
export function rangLisible(rang: number, sur: number, codeInsee: string | null): string {
  const ordinal = rang === 1 ? "la commune la moins bien dotée" : `la ${rang}ᵉ commune la moins bien dotée`;
  return `${ordinal} sur ${sur} ${territoireDuCode(codeInsee)}`;
}

