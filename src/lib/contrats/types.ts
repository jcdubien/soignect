export interface ContractParty {
  name: string;
  profession: string;
  location: string;
}

export interface ContractDataRemplacement {
  remplace: ContractParty;
  remplacant: ContractParty;
  startDate: string | null;
  endDate: string | null;
  retrocessionPct: number;
  rayonKm: number;
  periodeEssai: boolean;
  generatedAt: string;
}

export interface ContractDataAssisanat {
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

export interface ContractDataCollaboration {
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
