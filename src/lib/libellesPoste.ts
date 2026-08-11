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

export interface Publieur {
  type?: string | null;           // ProfileType
  titulaireKind?: string | null;  // CABINET | STRUCTURE
}

export function estEtablissement(p?: Publieur | null): boolean {
  return p?.type === "TITULAIRE" && p?.titulaireKind === "STRUCTURE";
}

export function estCandidat(p?: Publieur | null): boolean {
  return p?.type === "REMPLACANT" || p?.type === "ASSISTANT";
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

export function libelleTypePoste(missionType: string, publieur?: Publieur | null): string {
  const table = estCandidat(publieur) ? CANDIDAT : estEtablissement(publieur) ? ETABLISSEMENT : CABINET;
  return table[missionType] ?? missionType;
}

// Qui publie. « Cabinet » était affiché pour tout profil TITULAIRE — un hôpital, un EHPAD ou une
// clinique s'y retrouvaient donc étiquetés « Cabinet » sur la carte de swipe.
export function libelleAuteur(publieur?: Publieur | null, court = false): string {
  if (estEtablissement(publieur)) return court ? "Étab." : "Établissement";
  if (publieur?.type === "TITULAIRE") return "Cabinet";
  if (publieur?.type === "ASSISTANT") return court ? "Assist." : "Assistant";
  if (publieur?.type === "REMPLACANT") return court ? "Kiné" : "Remplaçant";
  return "Profil";
}
