// Barèmes de compatibilité et LECTURE QUALITATIVE partagée serveur/client.
//
// Le détail chiffré (« Dates 28/35 ») n'est pas montré aux utilisateurs : un barème exposé
// invite à l'arbitrage et à la contestation, sans les aider à décider. Une phrase — « Dates
// compatibles », « Secteur voisin » — porte la même information utile. Les nombres restent
// disponibles pour l'administration, où ils servent vraiment.

export type WeightProfile = { dates: number; geo: number; bio: number; logement: number; vehicule: number };

// Trois profils, chacun somme 100 (section 120). La désirabilité n'en fait plus partie :
// c'est un critère d'ORDRE D'AFFICHAGE, pas de compatibilité (voir lib/desirability).
export const WEIGHTS_REMPLACEMENT:  WeightProfile = { dates: 35, geo: 25, bio: 20, logement: 10, vehicule: 10 };
export const WEIGHTS_COLLABORATION: WeightProfile = { dates: 40, geo: 30, bio: 30, logement: 0,  vehicule: 0  };
export const WEIGHTS_ASSISTANAT:    WeightProfile = { dates: 20, geo: 25, bio: 55, logement: 0,  vehicule: 0  };

export function weightsFor(missionType?: string | null): { w: WeightProfile; label: string } {
  if (missionType === "ASSISTANAT")    return { w: WEIGHTS_ASSISTANAT,    label: "ASSISTANAT" };
  if (missionType === "COLLABORATION") return { w: WEIGHTS_COLLABORATION, label: "COLLABORATION" };
  return { w: WEIGHTS_REMPLACEMENT, label: "REMPLACEMENT" };
}

export const PROFILE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  COLLABORATION: "Collaboration",
  ASSISTANAT: "Assistanat",
};

export type Ton = "fort" | "moyen" | "faible";
export interface Mention { cle: string; texte: string; ton: Ton }

// Formulations par composante, du plus favorable au moins favorable.
const MENTIONS: Record<"dates" | "geo" | "bio", [string, string, string]> = {
  dates: ["Dates compatibles", "Dates partiellement compatibles", "Dates éloignées"],
  geo:   ["Même secteur",      "Secteur voisin",                  "Secteurs éloignés"],
  bio:   ["Profils proches",   "Profils compatibles",             "Profils différents"],
};

function ton(val: number, max: number): Ton {
  if (max <= 0) return "moyen";
  const r = val / max;
  return r >= 0.75 ? "fort" : r >= 0.4 ? "moyen" : "faible";
}

// Traduit un scoreDetails stocké en mentions lisibles. Tolère les anciennes lignes (clés
// manquantes, ancienne composante « desirability » simplement ignorée).
export function lectureQualitative(details: Record<string, number | string> | null | undefined): Mention[] {
  if (!details) return [];
  const profKey = typeof details.profile === "string" ? details.profile : "REMPLACEMENT";
  const { w } = weightsFor(profKey);
  const mentions: Mention[] = [];

  for (const cle of ["dates", "geo", "bio"] as const) {
    const val = Number(details[cle] ?? NaN);
    if (!Number.isFinite(val)) continue;
    const t = ton(val, w[cle]);
    mentions.push({ cle, texte: MENTIONS[cle][t === "fort" ? 0 : t === "moyen" ? 1 : 2], ton: t });
  }
  // Avantages matériels : mentionnés seulement quand ils sont acquis — une absence de logement
  // n'est pas un défaut de compatibilité, c'est simplement l'ordinaire.
  if (Number(details.logement ?? 0) > 0) mentions.push({ cle: "logement", texte: "Logement proposé", ton: "fort" });
  if (Number(details.vehicule ?? 0) > 0) mentions.push({ cle: "vehicule", texte: "Véhicule proposé", ton: "fort" });

  return mentions;
}
