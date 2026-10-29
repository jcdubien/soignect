import { COMMUNES_GUADELOUPE, COMMUNES_MARTINIQUE } from "@/lib/communes";

// Annonce en 4 champs (section 369) — titre et accroche DÉDUITS de ce que le cabinet a saisi.
//
// Le cabinet ne remplit plus que le type, les dates, la commune et l'argent. Le titre (exigé par
// la route, 3 caractères minimum) et l'accroche de la carte se composent à partir de ces seuls
// champs : rien n'est ajouté qui n'ait été saisi. Dès que le cabinet écrit son propre titre ou
// son propre texte, ceux-ci priment — l'automatique n'est qu'un repli.

export type ChampsRapides = {
  type: string;                 // libellé affiché : « Remplacement », « Assistanat », « CDI »…
  commune: string;
  debut?: string;               // AAAA-MM-JJ
  fin?: string;
  minMonths?: string;
  argent?: string;              // phrase déjà formée : « Rétrocession de 75 % pour le remplaçant »
  logement?: boolean;
  vehicule?: boolean;
};

function jour(v?: string): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [a, m, j] = v.split("-");
  return `${j}/${m}/${a}`;
}

function periode(c: ChampsRapides): string {
  const d = jour(c.debut);
  const f = jour(c.fin);
  if (d && f) return ` du ${d} au ${f}`;
  if (d) return ` à partir du ${d}`;
  return "";
}

export function titreAuto(c: ChampsRapides): string {
  const base = c.commune ? `${c.type} à ${c.commune}` : c.type;
  const d = jour(c.debut);
  const f = jour(c.fin);
  // Le titre reste court : jour/mois seulement, l'année est dans l'accroche et la fiche.
  const p = d && f ? ` · ${d.slice(0, 5)} → ${f.slice(0, 5)}` : d ? ` · dès le ${d.slice(0, 5)}` : "";
  return `${base}${p}`.slice(0, 100);
}

export function accrocheAuto(c: ChampsRapides): string {
  const phrases = [`${c.type}${c.commune ? ` à ${c.commune}` : ""}${periode(c)}.`];
  if (c.minMonths) phrases.push(`Durée minimale : ${c.minMonths} mois.`);
  if (c.argent) phrases.push(`${c.argent}.`);
  const avantages = [c.logement && "logement proposé", c.vehicule && "véhicule mis à disposition"].filter(Boolean);
  if (avantages.length) phrases.push(`${avantages.join(", ").replace(/^./, (x) => x.toUpperCase())}.`);
  return phrases.join(" ");
}

// ── RECONNAÎTRE CE QUI A ÉTÉ DÉDUIT ─────────────────────────────────────────────────────────
//
// Un titre ou une accroche automatiques portent les DATES de l'annonce. Republiés ou modifiés
// tels quels, ils annonceraient l'ancienne période. On les reconnaît à leur forme exacte, pour
// les recomposer à partir des champs du moment ; un texte écrit par le cabinet ne prend jamais
// cette forme à l'identique, et il n'est alors pas touché.
const D = String.raw`\d{2}/\d{2}/\d{4}`;
const echappe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// La commune vient de la liste fermée : « Remplacement à Sainte-Anne, cabinet calme. » écrit à
// la main ne doit pas passer pour une phrase déduite.
const COMMUNE = `( à (${[...COMMUNES_GUADELOUPE, ...COMMUNES_MARTINIQUE].map(echappe).join("|")}))?`;
const PERIODE = String.raw`( du ${D} au ${D}| à partir du ${D})?`;
const PHRASES_SUIVANTES = [
  /^Durée minimale : \d+ mois\.$/,
  /^(Rétrocession|Redevance|Rémunération brute) de [^.]+\.$/,
  /^(Logement proposé|Véhicule mis à disposition)(, véhicule mis à disposition)?\.$/,
];

export function estAccrocheAuto(texte: string, type: string): boolean {
  const t = texte.trim();
  if (!t.startsWith(type)) return false;
  const phrases = t.split(/(?<=\.) (?=[A-ZÉ])/);
  if (!new RegExp(`^${echappe(type)}${COMMUNE}${PERIODE}\\.$`).test(phrases[0])) return false;
  return phrases.slice(1).every((ph) => PHRASES_SUIVANTES.some((re) => re.test(ph)));
}

// Seul un titre qui porte des dates est recomposé : « Remplacement à Le Gosier » écrit à la main
// reste tel quel, il ne dit rien de faux.
export function estTitreAutoDate(titre: string, type: string): boolean {
  return titre.startsWith(type) && /( · \d{2}\/\d{2} → \d{2}\/\d{2}| · dès le \d{2}\/\d{2})$/.test(titre);
}
