export interface ContractParty {
  name: string;
  profession: string;
  location: string;
  // Identité contractuelle (section 150) — injectée dans le PDF (remplace les placeholders).
  rpps?: string | null;
  numeroOrdre?: string | null;
  adresse?: string | null;
  siret?: string | null;
  isStructure?: boolean; // structure employeuse → SIRET au lieu de RPPS/Ordre

  /** Valeur d'enum `Profession`, en plus du libellé affiché ci-dessus. Sert à choisir le
   *  VOCABULAIRE de l'ordre concerné (« N° Ordre » chez le CNOMK, « n° ordinal » chez le CNOI).
   *  Optionnel : absent, l'affichage retombe sur la forme générique, jamais sur une invention. */
  professionEnum?: string | null;

  /** Remplaçant infirmier NON INSTALLÉ (variante « titulaire d'une autorisation ») — le modèle
   *  du CNOI exige que le contrat porte le numéro et la date de l'autorisation délivrée par le
   *  conseil de l'Ordre, ainsi que la CPAM qui l'a autorisé. Aucune de ces trois données
   *  n'existe sur `Profile` : elles sont SAISIES À LA GÉNÉRATION du contrat (décision du 27/08),
   *  et non déclarées à l'inscription — un champ qu'on ne remplit qu'une fois tous les trente-six
   *  du mois devient un levier dormant, et le produit en compte déjà quatre. */
  autorisationNumero?: string | null;
  autorisationDate?: string | null;
  cpamRattachement?: string | null;
}

// Images de signature (data URL base64) — apposées en bas du contrat (section 61).
// "titulaire" = partie qui recrute/propose ; "remplacant" = partie qui candidate.
export interface SignatureImages {
  signatureTitulaireImg?: string | null;
  signatureRemplacantImg?: string | null;
  // Aperçu/brouillon (section 137) — ajoute un filigrane « DOCUMENT NON OFFICIEL »
  // et bloque toute confusion avec le contrat officiel signé. Téléchargeable avant
  // les deux signatures ; le PDF officiel (sans filigrane) reste réservé au bothSigned.
  draft?: boolean;
}

// Clauses négociables saisies dans le formulaire de contrat (section 164) — remplacent les
// placeholders figés [virement bancaire / …], [délai], [modalités à préciser] des templates.
// Éditables tant que le contrat n'est pas signé des deux côtés (même verrou que les autres
// champs négociables : rayon / durée / taux / période d'essai, section 137).
export interface NegotiableClauses {
  modePaiement: string;       // "Virement bancaire" | "Chèque" | "Espèces" | "Autre"
  delaiPaiementJours: number; // délai de paiement de la rétrocession/redevance (jours)
  modalitesLocaux: string;    // modalités de répartition des charges locaux/matériel (texte libre)
}

// Phrase injectée après « versé(e) par … » selon le mode de paiement choisi.
export function paymentMethodPhrase(mode: string): string {
  switch (mode) {
    case "Chèque":  return "chèque";
    case "Espèces": return "espèces";
    case "Autre":   return "un autre moyen convenu entre les parties";
    case "Virement bancaire":
    default:        return "virement bancaire";
  }
}

// Modalités locaux : valeur saisie, ou repli neutre non bloquant si le champ est laissé vide.
export function localModalities(value: string): string {
  const v = value.trim();
  return v.length > 0 ? v : "à convenir entre les parties";
}

/** Remplacement infirmier — variante « remplaçant titulaire d'une autorisation d'exercice »
 *  (modèle CNOI du 15/11/2023). Distincte de `ContractDataRemplacement` (CNOMK) : la
 *  rétrocession y va dans l'AUTRE SENS. Chez le kiné, le remplaçant reverse un pourcentage au
 *  remplacé ; ici c'est le REMPLACÉ qui reverse au remplaçant, parce que c'est lui qui
 *  encaisse — le remplaçant n'étant pas installé, il facture avec sa CPS « remplaçant » et les
 *  honoraires transitent par le remplacé. Réutiliser `retrocessionPct` aurait inversé le sens
 *  d'un pourcentage sur un document signé.
 *
 *  Deux délais distincts, tels que le modèle les sépare : paiement direct par l'assuré, et
 *  tiers payant. Les fondre en un seul aurait simplifié le type au prix du contrat. */
export interface ContractDataRemplacementInfirmierAutorise extends SignatureImages {
  remplace: ContractParty;
  remplacant: ContractParty;
  startDate: string | null;
  endDate: string | null;
  /** Part des honoraires REVERSÉE PAR LE REMPLACÉ AU REMPLAÇANT (paiement direct). */
  reversementDirectPct: number;
  reversementDirectDelaiMois: number;
  /** Idem pour les actes réglés en tiers payant, que le remplacé continue de percevoir. */
  reversementTiersPayantPct: number;
  reversementTiersPayantDelaiMois: number;
  /** Rayon de non-concurrence — art. R.4312-87 CSP (choix A-2 du 27/08 : rayon, pas communes). */
  rayonKm: number;
  /** Préavis de résiliation d'un commun accord (art. 8.1) et unilatérale (art. 8.2), en jours. */
  preavisCommunAccordJours: number;
  preavisUnilateralJours: number;
  /** Description des locaux et moyens mis à disposition (art. 3), saisie librement. */
  moyensMisADisposition: string;
  generatedAt: string;
}

export interface ContractDataRemplacement extends SignatureImages, NegotiableClauses {
  remplace: ContractParty;
  remplacant: ContractParty;
  startDate: string | null;
  endDate: string | null;
  retrocessionPct: number;
  rayonKm: number;
  periodeEssai: boolean;
  generatedAt: string;
}

export interface ContractDataAssisanat extends SignatureImages, NegotiableClauses {
  titulaire: ContractParty;
  assistant: ContractParty;
  startDate: string | null;
  minMonths: number | null;
  redevancePct: number;
  rayonKm: number;
  dureeAns: number;
  periodeEssai: boolean;
  generatedAt: string;
}

export interface ContractDataCollaboration extends SignatureImages, NegotiableClauses {
  titulaire: ContractParty;
  collaborateur: ContractParty;
  startDate: string | null;
  minMonths: number | null;
  redevancePct: number;
  rayonKm: number;
  dureeAns: number;
  periodeEssai: boolean;
  generatedAt: string;
}

// Mention légale sur la valeur de la signature photo (section 61 — eIDAS)
export const SIGNATURE_LEGAL_MENTION =
  "Ce document a été signé électroniquement par apposition d'une image de signature " +
  "manuscrite. Il ne constitue pas une signature électronique qualifiée au sens du " +
  "règlement eIDAS. Les parties reconnaissent la validité de ce mode de signature " +
  "pour les besoins de ce contrat.";
