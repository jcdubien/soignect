import { prisma } from "@/lib/prisma";
import type { CommuneAPL, Profession } from "@prisma/client";

// Le niveau de priorité qu'une commune tire de l'APL DREES, profession par profession (20/10).
//
// ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────────
//
// C'est celle des anciens `boost*`, retrouvée le 20/10 et vérifiée sans un écart sur les quatre
// professions et les 112 communes : un RANG dans le département, pas un seuil.
//   · APL nul                → 3 (aucun professionnel accessible)
//   · premier quart          → 2
//   · deuxième quart         → 1
//   · moitié la mieux dotée  → 0 (pas de priorité)
// Un seuil fixe ne marcherait pas : un APL kiné de 150 est bas à La Réunion, médian en
// Guadeloupe. Et chaque profession a son APL et ses unités (médecins : consultations par
// habitant ; les autres : ETP pour 100 000 habitants) — rien ne se compare d'une colonne à
// l'autre, d'où un classement par colonne.
//
// Les professions sans APL publié (orthophonistes, dentistes, aides-soignants, spécialistes…)
// n'ont pas de niveau calculé : la DREES ne dit rien d'eux, le produit non plus.

export const COLONNE_APL: Partial<Record<Profession, "aplKine" | "aplInfirmier" | "aplMedecin" | "aplSageFemme">> = {
  KINESITHERAPEUTE: "aplKine",
  INFIRMIER: "aplInfirmier",
  MEDECIN_GENERALISTE: "aplMedecin",
  SAGE_FEMME: "aplSageFemme",
};

export const PROFESSIONS_AVEC_APL = Object.keys(COLONNE_APL) as Profession[];

export interface PalierApl {
  codeInsee: string;
  commune: string;
  profession: Profession;
  apl: number;
  niveau: number;
  rang: number;
  sur: number;
  annee: number | null;
}

/** Les paliers de toutes les communes demandées, toutes professions avec APL, niveaux nuls
 *  compris — l'appelant décide s'il les montre. Le classement se fait sur le département entier
 *  de chaque commune, jamais sur le seul périmètre : sur 4 communes, « le premier quart »
 *  désignerait une commune quelle que soit sa dotation réelle. */
export async function paliersApl(codes: string[]): Promise<PalierApl[]> {
  if (codes.length === 0) return [];
  const demandees = await prisma.communeAPL.findMany({ where: { codeInsee: { in: codes } } });
  const departements = Array.from(new Set(demandees.map((r) => r.departement)));
  const toutes = await prisma.communeAPL.findMany({ where: { departement: { in: departements } } });

  const sortie: PalierApl[] = [];
  for (const profession of PROFESSIONS_AVEC_APL) {
    const col = COLONNE_APL[profession]!;
    for (const dep of departements) {
      const classees = toutes
        .filter((r) => r.departement === dep && r[col] != null)
        .sort((a, b) => (a[col] as number) - (b[col] as number));
      const quart = Math.floor(classees.length / 4);
      classees.forEach((r: CommuneAPL, i) => {
        if (!codes.includes(r.codeInsee)) return;
        const apl = r[col] as number;
        sortie.push({
          codeInsee: r.codeInsee, commune: r.commune, profession, apl,
          niveau: apl === 0 ? 3 : i < quart ? 2 : i < 2 * quart ? 1 : 0,
          rang: i + 1, sur: classees.length, annee: r.aplAnnee,
        });
      });
    }
  }
  return sortie;
}

/** « accès très faible » — ce que le niveau veut dire, pour un soignant qui ne sait pas ce
 *  qu'est l'APL. */
export function libelleAcces(niveau: number): string {
  return niveau >= 3 ? "aucun professionnel accessible"
    : niveau === 2 ? "accès très faible"
    : niveau === 1 ? "accès faible"
    : "accès dans la moyenne ou au-dessus";
}
