import fs from "fs";
import path from "path";
import type { LegalKey } from "./legal-links";

// Lecture des documents légaux Markdown (section 150). Fichiers à la racine du repo,
// inclus dans le bundle serverless via next.config outputFileTracingIncludes.
const FILES: Record<LegalKey, { file: string; title: string }> = {
  "mentions-legales": { file: "mentions-legales.md",          title: "Mentions légales" },
  "confidentialite":  { file: "politique-confidentialite.md", title: "Politique de confidentialité" },
  "cgu":              { file: "cgu-cgv.md",                    title: "Conditions Générales d'Utilisation et de Vente" },
};

export function readLegalDoc(key: LegalKey): { title: string; markdown: string } {
  const { file, title } = FILES[key];
  const markdown = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  return { title, markdown };
}
