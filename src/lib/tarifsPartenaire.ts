// Grille de l'offre partenaire (section 303) — source UNIQUE des prix affichés. Arrêtée par
// Jean-Charles le 14/10. Un prix change ici, nulle part ailleurs.
//
// Montants HT, à l'année, engagement d'un an. Le tarif de lancement est réservé aux cinq
// premiers partenaires, pour la première année, contre logo et retour d'expérience à six mois.
// La CPTS Nord Basse-Terre n'est pas concernée : elle reste gratuite (conflit d'intérêts).

import type { TypeInstitution } from "@prisma/client";

export type ClePalier = "MSP" | "CPTS" | "ETABLISSEMENT" | "HOPITAL";

export interface TarifPartenaire {
  cle: ClePalier;
  pour: string;
  contenu: string;
  /** Communes couvertes par l'offre — null = sans plafond (CPTS : « tout votre territoire »,
   *  hôpital : sur devis). Lu par /admin/pages pour borner le périmètre (point 7, 21/10). */
  communesMax: number | null;
  /** Cases (commune × profession prioritaires) que l'offre porte — null = sans plafond, mais
   *  soumise à la densité du fil (lib/boostTerritorial). Hôpital : sur devis, à vérifier. */
  casesMax: number | null;
  prixAn: number;
  lancementAn: number;
  /** « à partir de » : au-delà du périmètre décrit, sur devis. */
  aPartirDe?: boolean;
  /** Portes de diffusion où cette ligne est celle du visiteur — mise en évidence. */
  portes: string[];
  /** Payment Link Stripe (https://buy.stripe.com/…) au tarif de LANCEMENT, abonnement annuel.
   *  URL publique, pas un secret. Vide = pas de bouton de paiement sur la ligne. Les cinq places
   *  de lancement prises, remplacer le lien par celui du prix plein.
   *  Le webhook ignore ces paiements (pas de `profileId` en métadonnées) : rien ne s'active
   *  tout seul, l'administrateur saisit les communes à réception — c'est voulu. */
  lienPaiement?: string;
}

export const TARIFS_PARTENAIRE: TarifPartenaire[] = [
  {
    cle: "MSP", pour: "Maison de santé",
    contenu: "1 commune, toutes professions",
    communesMax: 1, casesMax: 8,
    prixAn: 590, lancementAn: 290, portes: ["maison-de-sante"],
    lienPaiement: "https://buy.stripe.com/aFa5kE6uoghma6IdhleZ204",
  },
  {
    cle: "CPTS", pour: "CPTS, collectivité",
    contenu: "Tout votre territoire, module pour votre site, bilan trimestriel",
    communesMax: null, casesMax: null,
    prixAn: 1900, lancementAn: 950, portes: ["territoire"],
    lienPaiement: "https://buy.stripe.com/9B6bJ22e83uAceQa59eZ205",
  },
  {
    cle: "ETABLISSEMENT", pour: "EHPAD, SSIAD, SSR, clinique",
    contenu: "1 établissement, 2 communes, forfait Structure inclus",
    communesMax: 2, casesMax: 16,
    prixAn: 1900, lancementAn: 950, portes: ["emploi"],
    lienPaiement: "https://buy.stripe.com/fZu6oI9GA9SYdiUcdheZ203",
  },
  {
    cle: "HOPITAL", pour: "Hôpital",
    contenu: "Plusieurs sites et services, bilan trimestriel",
    communesMax: null, casesMax: null,
    prixAn: 4900, lancementAn: 2900, aPartirDe: true, portes: ["emploi"],
    lienPaiement: "https://buy.stripe.com/aFa5kEdWQ4yEbaM0uzeZ202",
  },
];

/** Le palier de l'offre selon le type de structure. null = aucune offre publiée pour ce type
 *  (ARS, CGSS, autre) : sur devis, sans plafond codé — comme avant le point 7. */
export const PALIER_DU_TYPE: Record<TypeInstitution, ClePalier | null> = {
  MSP: "MSP",
  EHPAD: "ETABLISSEMENT", SSIAD: "ETABLISSEMENT", SSR: "ETABLISSEMENT", CLINIQUE: "ETABLISSEMENT",
  CPTS: "CPTS", COLLECTIVITE: "CPTS",
  HOPITAL: "HOPITAL",
  ARS: null, CGSS: null, AUTRE: null,
};

/** Plafonds de l'offre d'un type de structure — communes et cases. */
export function limitesDuType(type: TypeInstitution): { palier: ClePalier | null; communesMax: number | null; casesMax: number | null } {
  const palier = PALIER_DU_TYPE[type];
  const t = TARIFS_PARTENAIRE.find((x) => x.cle === palier);
  return { palier, communesMax: t?.communesMax ?? null, casesMax: t?.casesMax ?? null };
}

export function euros(n: number): string {
  return `${n.toLocaleString("fr-FR")} €`;
}
