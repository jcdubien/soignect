// Formatage de dates unifié (fr-FR) — source unique pour les surfaces PRODUIT
// (cartes de swipe, fiches, modales, planning, sélecteurs). Objectif : la même date
// s'affiche toujours pareil, quel que soit l'écran.
// NB : les tables admin, les contrats PDF (format légal long) et les prompts IA gardent
// volontairement leur propre format.

function parse(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const x = new Date(d as string);
  return isNaN(x.getTime()) ? null : x;
}

/** "31 juil." — compact, sans année (cartes, fiches, header, sélecteur). */
export function fmtDay(d: Date | string | null | undefined): string | null {
  const x = parse(d);
  return x ? x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;
}

/** "31 juil. 2026" — avec année (modales de confirmation, planning). */
export function fmtDayYear(d: Date | string | null | undefined): string | null {
  const x = parse(d);
  return x ? x.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : null;
}

/**
 * Plage de dates cohérente : "31 juil. → 29 sept." (ou avec année), sinon
 * "Dès le 31 juil." si seule la date de début est connue, sinon null.
 */
export function fmtRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  opts?: { year?: boolean },
): string | null {
  const f = opts?.year ? fmtDayYear : fmtDay;
  const s = f(start);
  const e = f(end);
  if (s && e) return `${s} → ${e}`;
  if (s) return `Dès le ${s}`;
  return null;
}

// ── Helpers « ne jamais proposer une date passée » (#2) ─────────────────────────

/** Date du jour au format input `yyyy-mm-dd`. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ramène une date suggérée `yyyy-mm-dd` à aujourd'hui si elle est dans le passé.
 * À utiliser pour les VALEURS PAR DÉFAUT des créations futures (annonce, etc.) —
 * ne bloque pas la saisie manuelle d'une date passée.
 */
export function notPast(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso < todayISO() ? todayISO() : iso;
}
