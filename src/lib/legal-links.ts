// Liens vers les documents légaux (section 150). Module PUR (aucun import serveur/fs) →
// utilisable côté client (footer, case d'inscription) comme côté serveur.
export type LegalKey = "mentions-legales" | "confidentialite" | "cgu";

export const LEGAL_LINKS: { key: LegalKey; href: string; label: string }[] = [
  { key: "mentions-legales", href: "/mentions-legales", label: "Mentions légales" },
  { key: "confidentialite",  href: "/confidentialite",  label: "Confidentialité" },
  { key: "cgu",              href: "/cgu",               label: "CGU / CGV" },
];
