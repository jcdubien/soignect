// Formule du boost territorial — SOURCE UNIQUE (point 4 de l'offre CPTS/MSP, 21/10).
//
// Pur, sans Prisma : lu par le fil (api/feed via lib/territoire), par l'écran admin des
// priorités et par les tests. Le jour où l'on rediscute un chiffre, c'est ici, et nulle part
// ailleurs — l'admin affichait jusqu'ici sa propre copie du facteur (×3), retirée.
//
// TROIS RÈGLES, arbitrées par JC le 20/10 :
//   1. MAXIMUM, PAS SOMME. Si plusieurs boosts touchent une annonce, seul le plus fort compte.
//      Aujourd'hui l'unicité commune × profession n'en laisse qu'un, et le bonus saisonnier ne
//      joue que devant un cabinet : la règle est écrite pour qu'un futur levier n'empile pas.
//   2. PLAFOND 35. Une annonce gratuite boostée (0 + 35) reste sous le palier Premium (50) :
//      le boost accélère l'accès, il ne remplace pas un plan supérieur.
//   3. DENSITÉ : au plus 1 annonce REMONTÉE PAR LE BOOST sur 3 consécutives dans le fil. Paramètre
//      unique, ajustable après mesure.

/** Points d'ordre par niveau de priorité (rang APL 1..3). Au-delà de 3 : le plafond. */
export const POINTS_BOOST_PAR_NIVEAU: Readonly<Record<number, number>> = { 1: 15, 2: 25, 3: 35 };

/** Plafond absolu d'un boost, quel que soit le niveau déclaré. */
export const PLAFOND_BOOST = 35;

/** Densité : au plus 1 annonce remontée par le boost par fenêtre de DENSITE_BOOST cartes. */
export const DENSITE_BOOST = 3;

/** Libellé de l'étiquette posée sur la carte d'une annonce de zone prioritaire. */
export const LIBELLE_ZONE_PRIORITAIRE = "Zone prioritaire";

/** Mention qui accompagne l'étiquette : la mise en avant est demandée par l'institution. */
export function mentionMiseEnAvant(institution: string): string {
  return `Mise en avant demandée par ${institution}`;
}

/** Convertit un niveau (1..10) en points d'ordre, plafonnés. 0 hors priorité. */
export function pointsBoost(niveau: number | null | undefined): number {
  if (!niveau || niveau <= 0) return 0;
  return Math.min(POINTS_BOOST_PAR_NIVEAU[Math.min(niveau, 3)] ?? PLAFOND_BOOST, PLAFOND_BOOST);
}

/** Règle 1 : de plusieurs boosts applicables, seul le plus fort compte — jamais la somme. */
export function boostRetenu(boosts: number[]): number {
  return Math.min(Math.max(0, ...boosts), PLAFOND_BOOST);
}

/**
 * Règle 3 — ordonne en respectant la densité. Glouton, carte par carte :
 *   · sans boost, la meilleure annonce au score de base ;
 *   · si aucune des DENSITE_BOOST − 1 cartes précédentes n'a été remontée par le boost, une
 *     annonce boostée peut passer devant — à condition que son score boosté dépasse STRICTEMENT
 *     le meilleur score de base. Elle compte alors comme « remontée ».
 * Une annonce qui serait passée de toute façon (un Premium en zone prioritaire) ne consomme pas
 * la fenêtre : elle n'a pas été remontée. Une annonce boostée en trop reprend son score de base.
 * À égalité, l'ordre d'entrée (le tri SQL) départage — l'algorithme est stable.
 *
 * Sans aucun boost, l'ordre rendu est exactement le tri décroissant du score de base.
 */
export function ordonnerAvecDensite<T>(
  items: T[],
  base: (t: T) => number,
  boost: (t: T) => number,
  densite: number = DENSITE_BOOST,
): { ordre: T[]; remontees: Set<T> } {
  const reste = items.map((t, i) => ({ t, i, b: base(t), p: boost(t) }));
  const ordre: T[] = [];
  const remontees = new Set<T>();
  let depuisDerniere = Infinity; // cartes posées depuis la dernière remontée
  const meilleur = (score: (x: (typeof reste)[number]) => number) =>
    reste.reduce<(typeof reste)[number] | null>(
      (m, x) => (m === null || score(x) > score(m) || (score(x) === score(m) && x.i < m.i) ? x : m),
      null,
    );

  while (reste.length > 0) {
    const sansBoost = meilleur((x) => x.b)!;
    let choisi = sansBoost;
    if (depuisDerniere >= densite - 1) {
      const avecBoost = meilleur((x) => x.b + x.p)!;
      if (avecBoost.p > 0 && avecBoost.b + avecBoost.p > sansBoost.b) choisi = avecBoost;
    }
    const remontee = choisi !== sansBoost;
    reste.splice(reste.indexOf(choisi), 1);
    ordre.push(choisi.t);
    if (remontee) { remontees.add(choisi.t); depuisDerniere = 0; } else depuisDerniere++;
  }
  return { ordre, remontees };
}
