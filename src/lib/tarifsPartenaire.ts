// Grille de l'offre partenaire (section 303) — source UNIQUE des prix affichés. Arrêtée par
// Jean-Charles le 14/10. Un prix change ici, nulle part ailleurs.
//
// Montants HT, à l'année, engagement d'un an. Le tarif de lancement est réservé aux cinq
// premiers partenaires, pour la première année, contre logo et retour d'expérience à six mois.
// La CPTS Nord Basse-Terre n'est pas concernée : elle reste gratuite (conflit d'intérêts).

import type { NatureRelationInstitutionnelle, PalierOffre, TypeInstitution } from "@prisma/client";

export type ClePalier = PalierOffre;

/** Souscription en ligne (boutons « Souscrire en ligne », Payment Links Stripe). FERMÉE le 22/10
 *  sur décision de JC : pas de vente tant que la relecture juridique de l'offre CPTS/MSP n'est
 *  pas faite. Les liens restent dans la grille ; passer à true pour les réafficher. */
export const VENTE_EN_LIGNE_OUVERTE = false;

/** Souscription en ligne possible (Premium, Boost, Structure) — 23/10, décision de JC. Fermée
 *  tant que la vente est fermée OU que le mode gratuit est actif : pendant le mode gratuit tout est
 *  déjà débloqué, un abonnement payé n'apporterait rien. Lu par la route de paiement et par chaque
 *  écran qui propose de souscrire. */
export function souscriptionEnLigneOuverte(freeAccessMode: boolean): boolean {
  return VENTE_EN_LIGNE_OUVERTE && !freeAccessMode;
}
// Parcours établissement, point 4 (22/10) : le même interrupteur ferme l'abonnement Structure de
// /premium (89 €/mois + 20 € par contrat signé) — affichage ET route de paiement. Aucun compte
// n'y était abonné. La commission au contrat est un point signalé à faire relire (section 7).

/** Abonnement Structure (établissements privés) — affiché par /premium. Souscription fermée
 *  (`souscriptionEnLigneOuverte`) ; montants à faire relire (section 7). */
export const TARIF_STRUCTURE = { mensuelEuros: 89, parContratEuros: 20 } as const;

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
  /** Palier gratuit (partenaire fondateur) : accès sans paiement, mêmes règles que les autres. */
  gratuit?: boolean;
  /** Hors grille publique : n'apparaît pas dans le bloc tarifaire des pages de diffusion. */
  prive?: boolean;
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
    contenu: "1 établissement, 2 communes",
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
  // Point 9 (22/10). Palier gratuit rattaché à une structure (`ClientInstitutionnel.palier`),
  // pas un cas spécial du code : mêmes plafonds que l'offre CPTS (tout le territoire, cases sans
  // plafond mais soumises à la densité du fil), même étiquette, même journal. Accordé à la CPTS
  // Nord Basse-Terre (conflit d'intérêts, voir l'en-tête) ; hors grille publique.
  {
    cle: "PARTENAIRE_FONDATEUR", pour: "Partenaire fondateur",
    contenu: "Tout le territoire, accès gratuit",
    communesMax: null, casesMax: null,
    prixAn: 0, lancementAn: 0, portes: [], gratuit: true, prive: true,
  },
];

/** Libellé court d'un palier, pour l'administration. */
export const LIBELLE_PALIER: Record<ClePalier, string> = {
  MSP: "MSP", ETABLISSEMENT: "Établissement", CPTS: "CPTS", HOPITAL: "Hôpital",
  PARTENAIRE_FONDATEUR: "Partenaire fondateur (gratuit)",
};

/** Le palier de l'offre selon le type de structure. null = aucune offre publiée pour ce type
 *  (ARS, CGSS, autre) : sur devis, sans plafond codé — comme avant le point 7. */
export const PALIER_DU_TYPE: Record<TypeInstitution, ClePalier | null> = {
  MSP: "MSP",
  EHPAD: "ETABLISSEMENT", SSIAD: "ETABLISSEMENT", SSR: "ETABLISSEMENT", CLINIQUE: "ETABLISSEMENT",
  CPTS: "CPTS", COLLECTIVITE: "CPTS",
  HOPITAL: "HOPITAL",
  ARS: null, CGSS: null, AUTRE: null,
};

/** Le palier d'une structure : celui qui lui est rattaché, sinon celui de son type. */
export function palierDuClient(client: { type: TypeInstitution; palier?: ClePalier | null }): ClePalier | null {
  return client.palier ?? PALIER_DU_TYPE[client.type];
}

/** Plafonds de l'offre d'une structure — communes, cases — et gratuité de son palier. */
export function limitesDuClient(client: { type: TypeInstitution; palier?: ClePalier | null }): {
  palier: ClePalier | null; communesMax: number | null; casesMax: number | null; gratuit: boolean;
} {
  const palier = palierDuClient(client);
  const t = TARIFS_PARTENAIRE.find((x) => x.cle === palier);
  return { palier, communesMax: t?.communesMax ?? null, casesMax: t?.casesMax ?? null, gratuit: t?.gratuit === true };
}

/** Accès gratuit : palier gratuit, ou relation qui n'est pas un client payant (PoC, gratuité
 *  négociée). C'est la mention que le journal conserve pour séparer pilote et payant. */
export function accesGratuit(client: { type: TypeInstitution; palier?: ClePalier | null; nature: NatureRelationInstitutionnelle }): boolean {
  return limitesDuClient(client).gratuit || client.nature !== "CLIENT_PAYANT";
}

export function euros(n: number): string {
  return `${n.toLocaleString("fr-FR")} €`;
}
