// Grille de l'offre partenaire (section 303) — source UNIQUE des prix affichés. Arrêtée par
// Jean-Charles le 14/10. Un prix change ici, nulle part ailleurs.
//
// Montants HT, à l'année, engagement d'un an. Le tarif de lancement est réservé aux cinq
// premiers partenaires, pour la première année, contre logo et retour d'expérience à six mois.
// La CPTS Nord Basse-Terre n'est pas concernée : elle reste gratuite (conflit d'intérêts).

export interface TarifPartenaire {
  cle: "MSP" | "CPTS" | "ETABLISSEMENT" | "HOPITAL";
  pour: string;
  contenu: string;
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
    prixAn: 590, lancementAn: 290, portes: ["maison-de-sante"],
  },
  {
    cle: "CPTS", pour: "CPTS, collectivité",
    contenu: "Tout votre territoire, module pour votre site, bilan trimestriel",
    prixAn: 1900, lancementAn: 950, portes: ["territoire"],
  },
  {
    cle: "ETABLISSEMENT", pour: "EHPAD, SSR, clinique",
    contenu: "1 établissement, 2 communes, forfait Structure inclus",
    prixAn: 1900, lancementAn: 950, portes: ["emploi"],
  },
  {
    cle: "HOPITAL", pour: "Hôpital",
    contenu: "Plusieurs sites et services, bilan trimestriel",
    prixAn: 4900, lancementAn: 2900, aPartirDe: true, portes: ["emploi"],
  },
];

export function euros(n: number): string {
  return `${n.toLocaleString("fr-FR")} €`;
}
