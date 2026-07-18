// Identité contractuelle (section 150) — champs du Profile requis avant génération d'un
// contrat, injectés dans le PDF. Praticiens (cabinet/remplaçant/assistant) : RPPS + N° Ordre
// + adresse. Structures employeuses : SIRET + adresse. Nom requis pour tous.
// Source unique de vérité, partagée serveur (blocage/PDF) et client (/compte, contrat).

export interface ContractIdentity {
  name?: string | null;
  adresse?: string | null;
  rpps?: string | null;
  numeroOrdre?: string | null;
  siret?: string | null;
  titulaireKind?: string | null; // "STRUCTURE" ⇒ structure employeuse
}

export type ContractField = "name" | "adresse" | "rpps" | "numeroOrdre" | "siret";

export const CONTRACT_FIELD_LABELS: Record<ContractField, string> = {
  name:        "Nom complet",
  adresse:     "Adresse professionnelle",
  rpps:        "N° RPPS",
  numeroOrdre: "N° d'inscription à l'Ordre",
  siret:       "N° SIRET",
};

export function isStructureProfile(p: Pick<ContractIdentity, "titulaireKind">): boolean {
  return p.titulaireKind === "STRUCTURE";
}

// Liste des champs requis pour ce profil (dépend du type structure vs praticien).
export function requiredContractFields(p: Pick<ContractIdentity, "titulaireKind">): ContractField[] {
  const base: ContractField[] = ["name", "adresse"];
  return isStructureProfile(p)
    ? [...base, "siret"]
    : [...base, "rpps", "numeroOrdre"];
}

// Champs requis manquants (vides/espaces) pour ce profil.
export function missingContractFields(p: ContractIdentity): ContractField[] {
  return requiredContractFields(p).filter((f) => {
    const v = p[f];
    return !(typeof v === "string" && v.trim().length > 0);
  });
}

export function isContractProfileComplete(p: ContractIdentity): boolean {
  return missingContractFields(p).length === 0;
}

export function missingContractLabels(p: ContractIdentity): string[] {
  return missingContractFields(p).map((f) => CONTRACT_FIELD_LABELS[f]);
}
