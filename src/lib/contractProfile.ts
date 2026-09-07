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
  // « Nom » et non « Nom complet » : le formulaire de compte intitule ce champ « Nom du cabinet »
  // ou « Votre nom » selon le camp. Réclamer un « Nom complet » envoyait chercher un champ qui
  // n'existe sous ce nom nulle part — signalé le 06/09, captures d'écran à l'appui.
  name:        "Nom",
  adresse:     "Adresse professionnelle",
  rpps:        "N° RPPS",
  numeroOrdre: "N° d'inscription à l'Ordre",
  siret:       "N° SIRET",
};

/**
 * Les champs à SÉLECTIONNER pour pouvoir évaluer l'identité contractuelle (section 236).
 *
 * POURQUOI CETTE CONSTANTE EXISTE. La liste vivait recopiée à la main dans chaque requête. Celle
 * de la route de signature avait oublié `name` : le champ n'étant pas chargé, il valait
 * `undefined`, et la vérification le déclarait manquant — pour TOUS les profils, y compris ceux
 * dont le nom était rempli. « Nom complet » était donc réclamé sans qu'aucun écran ne puisse le
 * satisfaire, puisque le formulaire l'appelle « Nom du cabinet » et qu'il était déjà renseigné.
 *
 * Une liste de champs recopiée est une liste qui divergera. Elle est déclarée ici, à côté de la
 * fonction qui la consomme, pour que les deux ne puissent plus se contredire.
 */
export const CONTRACT_IDENTITY_SELECT = {
  name: true,
  adresse: true,
  rpps: true,
  numeroOrdre: true,
  siret: true,
  titulaireKind: true,
} as const;

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
