// Rapprochement de PÉRIODES — extrait de /api/swipe (section 190).
//
// Sorti de la route pour une raison précise : c'est cette logique qui a mal choisi la mission
// du swipeur en production, et tant qu'elle vivait dans un fichier de route Next elle n'était
// pas testable isolément. Elle sert maintenant à deux décisions distinctes — quelle annonce
// réciproque fonde le match, et quelle mission du swipeur sert de base au score.

export type Periode = { startDate: Date | null; endDate: Date | null };

// Recouvrement en jours entre deux périodes. null quand l'une des deux n'est pas bornée
// (annonce ouverte : « dès août », minMonths seul) : absence d'information, pas incompatibilité.
export function overlapDays(a: Periode, b: Periode): number | null {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return null;
  const start = Math.max(a.startDate.getTime(), b.startDate.getTime());
  const end   = Math.min(a.endDate.getTime(),   b.endDate.getTime());
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

// Écart en jours entre deux périodes disjointes (0 si elles se touchent ou se recouvrent).
export function gapDays(a: Periode, b: Periode): number {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return Number.MAX_SAFE_INTEGER;
  const ecart = a.startDate > b.endDate
    ? a.startDate.getTime() - b.endDate.getTime()
    : b.startDate.getTime() - a.endDate.getTime();
  return Math.max(0, Math.round(ecart / 86_400_000));
}

// Parmi les annonces que l'autre partie a retenues, celle qui correspond vraiment à la période
// visée, par ordre de préférence :
//   0. recouvrement réel — le plus large gagne ;
//   1. annonce non datée (« dès août », minMonths seul) : rien ne la contredit ;
//   2. dates disjointes mais annonce encore à venir ou en cours — l'écart le plus faible ;
//   3. annonce déjà passée : jamais retenue tant qu'il existe autre chose. Lier une nouvelle
//      mise en relation à une annonce périmée n'a aucun sens, or c'est exactement ce que
//      donnait le repli « la plus récemment swipée ».
// À égalité, la plus récente (liste triée par date décroissante, tri stable).
// Générique sur la façon de lire la période, car deux choix distincts s'en servent : l'annonce
// réciproque qui fondera le match, et LA MISSION DU SWIPEUR QUI SERT À CALCULER LE SCORE.
export function pickBestPeriode<T>(
  items: T[],
  periode: (t: T) => Periode,
  cible: Periode,
  maintenant: Date = new Date(),
): T | null {
  if (items.length === 0) return null;
  const classes = items.map((s) => {
    const p = periode(s);
    const o = overlapDays(p, cible);
    const perimee = !!p.endDate && p.endDate < maintenant;
    const rang = o === null ? 1 : o > 0 ? 0 : perimee ? 3 : 2;
    return { s, rang, recouvrement: o ?? 0, ecart: gapDays(p, cible) };
  });
  classes.sort((x, y) => x.rang - y.rang || y.recouvrement - x.recouvrement || x.ecart - y.ecart);
  return classes[0].s;
}
