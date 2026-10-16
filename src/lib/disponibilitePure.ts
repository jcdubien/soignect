import { BriqueStatus } from "@prisma/client";

// Calculs PURS de lib/disponibiliteSurPeriode — séparés de l'accès à la base pour être lus
// aussi par la feuille de disponibilité, côté navigateur, sans y embarquer Prisma.

export interface Intervalle {
  debut: string; // AAAA-MM-JJ, inclus
  fin: string;   // AAAA-MM-JJ, inclus
}

export interface Conflit extends Intervalle {
  motif: "REMPLACEMENT_CONFIRME" | "DATES_BLOQUEES";
}

export type EtatDisponibilite =
  /** Libre sur toute la période et déjà publié dessus : rien à faire. */
  | "COUVERT"
  /** Libre sur toute la période, mais une partie au moins n'est pas publiée. */
  | "LIBRE"
  /** Libre sur une partie seulement : se proposer sur les jours libres. */
  | "PARTIEL"
  /** Aucun jour libre : l'intérêt est refusé. */
  | "PRIS";

export interface Disponibilite {
  etat: EtatDisponibilite;
  /** Jours libres dans la période du poste. */
  libres: Intervalle[];
  /** Jours libres pas encore couverts par une disponibilité publiée — ce qu'il faut publier. */
  aPublier: Intervalle[];
  conflits: Conflit[];
}

const JOUR = 86400000;
export const jourIso = (d: Date) => d.toISOString().slice(0, 10);
const versMs = (j: string) => Date.parse(`${j}T00:00:00Z`);
const deMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** `base` privé des intervalles `retires`. Pure : c'est elle que l'on teste. */
export function soustraire(base: Intervalle[], retires: Intervalle[]): Intervalle[] {
  let reste = base.map((i) => ({ a: versMs(i.debut), b: versMs(i.fin) }));
  for (const r of retires) {
    const ra = versMs(r.debut), rb = versMs(r.fin);
    reste = reste.flatMap(({ a, b }) => {
      if (rb < a || ra > b) return [{ a, b }];
      const morceaux: { a: number; b: number }[] = [];
      if (ra > a) morceaux.push({ a, b: ra - JOUR });
      if (rb < b) morceaux.push({ a: rb + JOUR, b });
      return morceaux;
    });
  }
  return reste.map(({ a, b }) => ({ debut: deMs(a), fin: deMs(b) }));
}

/** Nombre de jours d'un ensemble d'intervalles disjoints. */
export function nbJours(intervalles: Intervalle[]): number {
  return intervalles.reduce((n, i) => n + (versMs(i.fin) - versMs(i.debut)) / JOUR + 1, 0);
}

/** Calcul pur, à partir des briques déjà lues. */
export function evaluerDisponibilite(
  periode: Intervalle,
  briques: { briqueStatus: BriqueStatus; startDate: Date | null; endDate: Date | null }[],
): Disponibilite {
  const datees = briques.filter((b) => b.startDate && b.endDate);
  const conflits: Conflit[] = datees
    .filter((b) => b.briqueStatus === BriqueStatus.CONFIRME || b.briqueStatus === BriqueStatus.INDISPONIBLE)
    .map((b) => ({
      debut: jourIso(b.startDate!),
      fin: jourIso(b.endDate!),
      motif: b.briqueStatus === BriqueStatus.CONFIRME ? "REMPLACEMENT_CONFIRME" as const : "DATES_BLOQUEES" as const,
    }))
    // Seuls ceux qui touchent la période comptent — et se lisent dans l'ordre.
    .filter((c) => c.fin >= periode.debut && c.debut <= periode.fin)
    .sort((x, y) => x.debut.localeCompare(y.debut));
  const couvertes: Intervalle[] = datees
    .filter((b) => b.briqueStatus === BriqueStatus.RECHERCHE)
    .map((b) => ({ debut: jourIso(b.startDate!), fin: jourIso(b.endDate!) }));

  const libres = soustraire([periode], conflits);
  const aPublier = soustraire(libres, couvertes);
  const etat: EtatDisponibilite =
    libres.length === 0 ? "PRIS"
    : conflits.length > 0 ? "PARTIEL"
    : aPublier.length === 0 ? "COUVERT"
    : "LIBRE";
  return { etat, libres, aPublier, conflits };
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** « 28 déc. » — découpe le texte civil, ne traverse aucun fuseau. */
export function jourCourt(j: string): string {
  const [, m, d] = j.split("-").map(Number);
  return `${d} ${MOIS[m - 1] ?? ""}`.trim();
}
export const intervalleCourt = (i: Intervalle) =>
  i.debut === i.fin ? `le ${jourCourt(i.debut)}` : `du ${jourCourt(i.debut)} au ${jourCourt(i.fin)}`;

/** Termine une phrase sans doubler le point d'une abréviation (« janv. » + « . »). */
export const finDePhrase = (t: string) => (t.endsWith(".") ? t : `${t}.`);

/** « remplacement confirmé du 2 au 5 janv. » — pour dire POURQUOI, jamais seulement « non ». */
export function phraseConflit(c: Conflit): string {
  return `${c.motif === "REMPLACEMENT_CONFIRME" ? "remplacement confirmé" : "dates bloquées"} ${intervalleCourt(c)}`;
}
