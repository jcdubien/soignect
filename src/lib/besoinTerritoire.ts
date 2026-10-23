// Besoin du territoire (23/10) — SOURCE UNIQUE des libellés, limites et règles. Pur : lu par les
// routes, la page de gestion et, plus tard, l'affichage (fil, /p, pages métier).
//
// Un besoin est le manque d'un territoire déclaré par une structure (« pas de dermatologue au
// Lamentin »). Ce n'est pas une offre d'emploi : pas de contrat, pas de rémunération, pas de
// période. Il se publie depuis la page de gestion de la structure, par ses éditeurs nommés ; la
// PREMIÈRE publication d'une structure passe par la validation de l'administration.
//
// À VALIDER PAR JC : la durée de publication (90 jours) et le nombre de besoins actifs par
// structure (10). Ce sont des garde-fous de départ, pas des règles d'offre.

import { contientUnNumero } from "@/lib/numeroTelephone";

export const NATURES_BESOIN = {
  INSTALLATION_LIBERALE: "Installation libérale",
  EXERCICE_MSP: "Exercice en maison de santé",
  VACATIONS: "Vacations",
  SALARIE: "Poste salarié",
} as const;
export type NatureBesoinCle = keyof typeof NATURES_BESOIN;

export const LIMITES_BESOIN = {
  texteMin: 30,
  texteMax: 1000,
  propositionMax: 500,
  specialiteMax: 80,
  motifMax: 300,
} as const;

/** Durée de publication, renouvelable — à valider. */
export const DUREE_PUBLICATION_JOURS = 90;
/** Besoins actifs (à valider ou publiés) par structure — à valider. */
export const BESOINS_ACTIFS_MAX = 10;

/** Étiquettes affichées avec un besoin, partout où il apparaît. */
export function etiquetteBesoin(nomStructure: string): string {
  return `Besoin du territoire — déclaré par ${nomStructure}`;
}
export const ETIQUETTE_PROPOSITION = "Déclaré par la structure";

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const LIEN = /https?:\/\/|www\./i;

/** Le contact passe par la messagerie Soignect : aucune coordonnée directe dans les textes. */
export function erreurTexteBesoin(champ: string, texte: string | null | undefined): string | null {
  if (!texte) return null;
  if (contientUnNumero(texte)) return `${champ} : pas de numéro de téléphone — le contact passe par la messagerie Soignect.`;
  if (EMAIL.test(texte)) return `${champ} : pas d'adresse email — le contact passe par la messagerie Soignect.`;
  if (LIEN.test(texte)) return `${champ} : pas de lien externe.`;
  return null;
}

/** Spécialité normalisée pour l'unicité : casse et espaces ignorés, vide = aucune. */
export function specialiteNormalisee(s: string | null | undefined): string | null {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  return t ? t : null;
}

export function echeanceDepuis(debut: Date): Date {
  return new Date(debut.getTime() + DUREE_PUBLICATION_JOURS * 86_400_000);
}
