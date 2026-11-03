// Vitrine du territoire (02/11) — SOURCE UNIQUE des rubriques, limites et règles. Pur : lu par les
// routes, la page de gestion, la page publique et le fil.
//
// La structure (CPTS, MSP, collectivité) présente son territoire aux soignants qui pourraient s'y
// installer : une accroche, trois rubriques, jusqu'à 4 photos légendées. La PREMIÈRE publication
// passe par l'administration ; les modifications suivantes paraissent directement (décision JC,
// 02/11), et l'administration peut la retirer à tout moment.

import { erreurTexteBesoin } from "@/lib/besoinTerritoire";

export const RUBRIQUES_VITRINE = [
  { cle: "cadreDeVie", titre: "Cadre de vie", aide: "Le territoire au quotidien : bourgs, plages, écoles, accès, rythme de vie." },
  { cle: "offreSoins", titre: "Offre de soins et exercice coordonné", aide: "Les professionnels déjà présents, la maison de santé, la CPTS, l'hôpital le plus proche." },
  { cle: "aidesInstallation", titre: "Aides à l'installation", aide: "Logement, locaux, aides de l'ARS ou de la commune, accompagnement proposé par la structure." },
] as const;
export type CleRubrique = (typeof RUBRIQUES_VITRINE)[number]["cle"];

export const LIMITES_VITRINE = {
  accrocheMin: 20,
  accrocheMax: 200,
  rubriqueMax: 1500,
  /** Au moins une rubrique de cette longueur pour demander la publication. */
  rubriqueMinPublication: 80,
  legendeMax: 120,
  photosMax: 4,
  motifMax: 300,
} as const;

export interface PhotoVitrine { url: string; chemin: string; legende: string }

export interface ContenuVitrine {
  accroche: string;
  cadreDeVie: string | null;
  offreSoins: string | null;
  aidesInstallation: string | null;
}

/** Ce qui s'affiche (page publique, fil) — jamais les chemins de stockage. */
export interface VitrinePublique extends ContenuVitrine {
  photos: { url: string; legende: string }[];
}

export const STATUTS_VITRINE = {
  BROUILLON: "Brouillon",
  A_VALIDER: "En attente de validation",
  PUBLIE: "Publiée",
  RETIREE: "Retirée par Soignect",
} as const;

/** Lecture défensive de la colonne JSON `photos`. */
export function photosDe(json: unknown): PhotoVitrine[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((p): p is PhotoVitrine => !!p && typeof p === "object" && typeof (p as PhotoVitrine).url === "string" && typeof (p as PhotoVitrine).chemin === "string")
    .map((p) => ({ url: p.url, chemin: p.chemin, legende: typeof p.legende === "string" ? p.legende : "" }))
    .slice(0, LIMITES_VITRINE.photosMax);
}

export function vitrinePublique(v: ContenuVitrine & { photos: unknown }): VitrinePublique {
  return {
    accroche: v.accroche, cadreDeVie: v.cadreDeVie, offreSoins: v.offreSoins, aidesInstallation: v.aidesInstallation,
    photos: photosDe(v.photos).map(({ url, legende }) => ({ url, legende })),
  };
}

/** Contrôle des textes à l'enregistrement — repris à l'identique par l'écran de gestion. Comme
 *  pour les besoins : aucune coordonnée directe, aucun lien externe. */
export function erreurContenuVitrine(c: ContenuVitrine, legendes: string[] = []): string | null {
  const a = c.accroche.trim();
  if (a.length < LIMITES_VITRINE.accrocheMin || a.length > LIMITES_VITRINE.accrocheMax) {
    return `L'accroche fait de ${LIMITES_VITRINE.accrocheMin} à ${LIMITES_VITRINE.accrocheMax} caractères.`;
  }
  const err = erreurTexteBesoin("L'accroche", a);
  if (err) return err;
  for (const r of RUBRIQUES_VITRINE) {
    const t = c[r.cle] ?? "";
    if (t.length > LIMITES_VITRINE.rubriqueMax) return `${r.titre} : ${LIMITES_VITRINE.rubriqueMax} caractères au plus.`;
    const e = erreurTexteBesoin(r.titre, t);
    if (e) return e;
  }
  for (const l of legendes) {
    if (l.length > LIMITES_VITRINE.legendeMax) return `Légende : ${LIMITES_VITRINE.legendeMax} caractères au plus.`;
    const e = erreurTexteBesoin("Une légende", l);
    if (e) return e;
  }
  return null;
}

/** Ce qui manque pour demander la publication (null = prête). */
export function erreurPublicationVitrine(c: ContenuVitrine): string | null {
  const pleine = RUBRIQUES_VITRINE.some((r) => (c[r.cle] ?? "").trim().length >= LIMITES_VITRINE.rubriqueMinPublication);
  return pleine ? null : `Rédigez au moins une rubrique (${LIMITES_VITRINE.rubriqueMinPublication} caractères ou plus) avant de publier.`;
}

/** Critères de validation de la première publication — lus par /admin/vitrines. */
export const CRITERES_VITRINE: readonly string[] = [
  "La vitrine présente le territoire de la structure (ses communes), pas un cabinet, un établissement ou une offre d'emploi particulière.",
  "Les aides et avantages cités existent et sont présentés comme déclarés par la structure : aucune promesse qu'elle ne peut garantir.",
  "Aucune coordonnée directe, aucun lien externe (le filtre automatique écarte numéros, emails et liens), aucune personne nommée sans son accord.",
  "Les photos montrent le territoire ; aucune personne reconnaissable sans son accord, aucun logo ou marque d'un tiers.",
  "Un ton respectueux, sans dénigrement d'un professionnel, d'une structure ou d'un autre territoire.",
];
