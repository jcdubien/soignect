// Comment NOMMER un poste selon qui le publie (section 192).
//
// Un même MissionType ne se dit pas pareil des deux côtés du marché : le formulaire employeur
// enregistre déjà une Vacation en REMPLACEMENT, un CDD en ASSISTANAT et un CDI en COLLABORATION.
// La donnée est donc juste — mais tout ce qui l'affichait la traduisait en vocabulaire libéral.
// Une offre de CDI hospitalier se partageait sur Facebook sous le libellé « Collaboration
// libérale », contresens complet sur la surface la plus publique du produit.
//
// Ces libellés vivent ICI et nulle part ailleurs : ils étaient écrits en dur dans la carte de
// partage, la page de diffusion, le feed et le tiroir des relations. Quatre copies d'une même
// règle divergent toujours — c'est d'ailleurs comme ça que le contresens a survécu.

import { contratFourniParEmployeur } from "@/lib/contrats/gabaritsSalarie";

export interface Publieur {
  type?: string | null;           // ProfileType
  titulaireKind?: string | null;  // CABINET | STRUCTURE
  // Facultative : elle seule distingue un candidat SALARIÉ (aide-soignant, section 304) d'un
  // remplaçant. Sans elle, le libellé reste celui d'avant.
  profession?: string | null;
}

export function estEtablissement(p?: Publieur | null): boolean {
  return p?.type === "TITULAIRE" && p?.titulaireKind === "STRUCTURE";
}

export function estCandidat(p?: Publieur | null): boolean {
  return p?.type === "REMPLACANT" || p?.type === "ASSISTANT";
}

/** Candidat d'une profession qui n'exerce qu'en salariat : il ne « remplace » personne. */
export function estCandidatSalarie(p?: Publieur | null): boolean {
  return estCandidat(p) && contratFourniParEmployeur(p?.profession);
}

/** Le rôle quand le vocabulaire libéral serait FAUX — établissement, candidat salarié —, sinon
 *  null, et chaque écran garde sa propre formule (« Cabinet / Titulaire », « Remplaçant·e »…).
 *  Section 304 : l'en-tête, le chat et la liste des relations disaient « Titulaire »,
 *  « Cabinet / Titulaire » ou « Remplaçant » à un EHPAD et à un aide-soignant. */
export function libelleRoleSalariat(p?: Publieur | null): string | null {
  if (estEtablissement(p)) return "Établissement";
  if (estCandidatSalarie(p)) return "Candidat·e";
  return null;
}

// Un établissement embauche : le vocabulaire est celui du contrat de travail.
const ETABLISSEMENT: Record<string, string> = {
  REMPLACEMENT: "Vacation",
  ASSISTANAT: "CDD",
  COLLABORATION: "CDI",
};

// Un cabinet libéral propose un exercice libéral.
const CABINET: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat · long terme",
  COLLABORATION: "Collaboration libérale",
};

// Un candidat SE propose — la formulation change de sujet, pas seulement de mot.
const CANDIDAT: Record<string, string> = {
  REMPLACEMENT: "Remplaçant disponible",
  ASSISTANAT: "Cherche un assistanat",
  COLLABORATION: "Cherche une collaboration",
};

export function libelleTypePoste(
  missionType: string,
  publieur?: Publieur | null,
  // La nature déclarée à la publication (section 262) prime : un CDD est rangé en REMPLACEMENT,
  // que la table établissement lirait « Vacation ».
  natureSalariat?: string | null,
): string {
  if (natureSalariat === "CDI") return "CDI";
  if (natureSalariat === "CDD_TERME" || natureSalariat === "CDD_SANS_TERME") return "CDD";
  const table = estCandidat(publieur) ? CANDIDAT : estEtablissement(publieur) ? ETABLISSEMENT : CABINET;
  return table[missionType] ?? missionType;
}

// ── Phrase d'INTENTION, pour la carte de partage (section 220) ────────────────────────────────
//
// Les libellés ci-dessus nomment le POSTE ; ils suffisent dans le produit, où l'on sait déjà de
// quel côté du marché on se trouve. Sur Facebook, non : « Remplacement » ne dit pas si un cabinet
// cherche quelqu'un ou si quelqu'un se propose, et le lecteur n'a aucun contexte pour trancher.
// Une étiquette neutre laisse donc le sens à deviner sur la surface la plus publique du produit —
// exactement la distinction déjà établie pour les pages persona (STRATEGIE_MARKETING §2).
//
// Ces phrases NOMMENT LE SUJET et le verbe. Elles ne remplacent pas `libelleTypePoste` : elles
// s'y ajoutent, pour le seul cas où le contexte manque.

const INTENTION_CABINET: Record<string, string> = {
  REMPLACEMENT:  "Ce cabinet recherche un remplaçant",
  ASSISTANAT:    "Ce cabinet recherche un assistant",
  COLLABORATION: "Ce cabinet recherche un collaborateur",
};

const INTENTION_ETABLISSEMENT: Record<string, string> = {
  REMPLACEMENT:  "Cet établissement recrute en vacation",
  ASSISTANAT:    "Cet établissement recrute en CDD",
  COLLABORATION: "Cet établissement recrute en CDI",
};

const INTENTION_CANDIDAT: Record<string, string> = {
  REMPLACEMENT:  "Propose sa disponibilité comme remplaçant",
  ASSISTANAT:    "Propose sa disponibilité comme assistant",
  COLLABORATION: "Propose sa disponibilité comme collaborateur",
};

/** Qui cherche quoi, en une phrase. Repli sur le libellé de poste plutôt que sur une phrase
 *  approximative : mieux vaut une étiquette neutre qu'une intention inventée. */
export function phraseIntentionPartage(missionType: string, publieur?: Publieur | null): string {
  const table = estCandidat(publieur)
    ? INTENTION_CANDIDAT
    : estEtablissement(publieur)
      ? INTENTION_ETABLISSEMENT
      : INTENTION_CABINET;
  return table[missionType] ?? libelleTypePoste(missionType, publieur);
}

// Qui publie. « Cabinet » était affiché pour tout profil TITULAIRE — un hôpital, un EHPAD ou une
// clinique s'y retrouvaient donc étiquetés « Cabinet » sur la carte de swipe.
export function libelleAuteur(publieur?: Publieur | null, court = false): string {
  if (estEtablissement(publieur)) return court ? "Étab." : "Établissement";
  if (publieur?.type === "TITULAIRE") return "Cabinet";
  if (publieur?.type === "ASSISTANT") return court ? "Assist." : "Assistant";
  // « Kiné » en forme courte jusqu'au 09/10 : la carte d'un infirmier remplaçant portait donc
  // l'étiquette « Kiné ». Le type `Publieur` ne porte pas la profession, et la lui ajouter
  // obligerait à l'aller chercher dans la dizaine d'appelants pour un mot de cinq lettres.
  // « Rempl. » dit la même chose que la forme longue, abrégée — c'est-à-dire le seul rôle que
  // cette étiquette a jamais eu (section 294).
  if (estCandidatSalarie(publieur)) return court ? "Cand." : "Candidat";
  if (publieur?.type === "REMPLACANT") return court ? "Rempl." : "Remplaçant";
  return "Profil";
}
