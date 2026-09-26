// Formatage de dates unifié (fr-FR) — source unique pour les surfaces PRODUIT
// (cartes de swipe, fiches, modales, planning, sélecteurs). Objectif : la même date
// s'affiche toujours pareil, quel que soit l'écran.
// IMPORTANT : les dates « jour seul » (dispo, annonce, poste) sont stockées à minuit UTC
// (créées via new Date('YYYY-MM-DD').toISOString()). Il FAUT donc les formater en UTC,
// sinon un fuseau négatif (ex. Guadeloupe UTC−4) affiche la veille : 10 août → « 9 août ».
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
  return x ? x.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }) : null;
}

/** "31 juil. 2026" — avec année (modales de confirmation, planning). */
export function fmtDayYear(d: Date | string | null | undefined): string | null {
  const x = parse(d);
  return x ? x.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
}

// ── L'ANNÉE APPARAÎT QUAND ELLE CHANGE QUELQUE CHOSE (section 267) ──────────────────────────
//
// CE QUE LE FORMAT COMPACT A COÛTÉ. Le 25/09, une annonce a été publiée pour « fin octobre »
// avec des dates de 2025 — onze mois dans le passé. La carte de swipe la présentait
// « 19 oct. → 1 nov. », sans année : parfaitement plausible pour une annonce publiée en
// septembre. Trois candidats l'ont vue, les trois ont passé. Aucun ne pouvait savoir ce qui
// clochait, pendant que le barème la sanctionnait en silence (0/35 sur les dates, soit 40 % du
// score d'un remplacement — 0 candidat sur 30 recouvrait la période).
//
// L'ANNÉE N'EST PAS AJOUTÉE PARTOUT, et c'est le point. Le format compact existe parce que la
// carte est étroite et que « 21 déc. → 16 janv. » se lit mieux que la même chose alourdie de
// deux années. On ne l'affiche donc que lorsqu'elle porte une information : quand la date n'est
// PAS dans les douze mois à venir. Ce seuil couvre les deux cas qui trompent — l'année fausse,
// et la période simplement écoulée.
const DOUZE_MOIS_MS = 365 * 24 * 60 * 60 * 1000;

/** Vrai si la date mérite d'être datée : passée, ou au-delà d'un an. */
export function anneeUtile(d: Date | string | null | undefined, ref: Date = new Date()): boolean {
  const x = parse(d);
  if (!x) return false;
  return x.getTime() < ref.getTime() || x.getTime() > ref.getTime() + DOUZE_MOIS_MS;
}

/** "31 juil." d'ordinaire, "19 oct. 2025" quand l'année change la lecture. */
export function fmtDayAuto(d: Date | string | null | undefined, ref: Date = new Date()): string | null {
  return anneeUtile(d, ref) ? fmtDayYear(d) : fmtDay(d);
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

/**
 * Lendemain d'une date `yyyy-mm-dd`. Sert à enchaîner une nouvelle période juste après
 * la fin d'une précédente, sans chevauchement d'un jour (ex. annonce « successeur »).
 */
export function nextDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
