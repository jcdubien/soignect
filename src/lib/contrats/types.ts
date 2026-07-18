export interface ContractParty {
  name: string;
  profession: string;
  location: string;
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

export interface ContractDataRemplacement extends SignatureImages {
  remplace: ContractParty;
  remplacant: ContractParty;
  startDate: string | null;
  endDate: string | null;
  retrocessionPct: number;
  rayonKm: number;
  periodeEssai: boolean;
  generatedAt: string;
}

export interface ContractDataAssisanat extends SignatureImages {
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

export interface ContractDataCollaboration extends SignatureImages {
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
