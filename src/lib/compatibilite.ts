// Barèmes de compatibilité et LECTURE QUALITATIVE partagée serveur/client.
//
// Le détail chiffré (« Dates 28/35 ») n'est pas montré aux utilisateurs : un barème exposé
// invite à l'arbitrage et à la contestation, sans les aider à décider. Une phrase — « Dates
// compatibles », « Secteur voisin » — porte la même information utile. Les nombres restent
// disponibles pour l'administration, où ils servent vraiment.

// ── Socle : les trois composantes toujours évaluées, en PROPORTIONS sommant 100 ─────────────
//
// Elles ne valent 100 points que si aucun bonus n'est en jeu. Sinon elles sont ramenées au
// prorata de ce qui reste (voir renormalisation plus bas). Exprimer des proportions plutôt que
// des points absolus est ce qui rend la renormalisation possible sans double barème.
export type SocleProfile = { dates: number; geo: number; bio: number };

export const SOCLE_REMPLACEMENT:  SocleProfile = { dates: 40, geo: 30, bio: 30 };
export const SOCLE_COLLABORATION: SocleProfile = { dates: 35, geo: 30, bio: 35 };
export const SOCLE_ASSISTANAT:    SocleProfile = { dates: 20, geo: 25, bio: 55 };

// La géographie pèse PLUS sur un remplacement court que sur un poste long : on ne déménage pas
// pour trois semaines, on déménage pour un assistanat. Un candidat à 40 km est disqualifiant
// dans un cas, secondaire dans l'autre.
//
// L'affinité de profils (« bio ») est plafonnée à 55 même là où elle est la plus pertinente :
// c'est la seule composante qui dépend d'un appel modèle, et la seule qui puisse retomber au
// neutre silencieusement (rate-limit DeepSeek, section 165). On ne lui confie pas la majorité
// absolue du score.

// ── Bonus : critères CONDITIONNELS, qui n'entrent au barème que si le chercheur les demande ──
export type BonusKey = "logement" | "vehicule" | "secretariat" | "coordination";

// Budget total des bonus : 20 points, inchangé par rapport au barème précédent (logement 10 +
// véhicule 10). Les deux nouveaux critères se partagent ce budget, ils ne l'augmentent pas —
// le socle garde donc le même poids relatif qu'avant.
//
// RÉPARTITION VALIDÉE par Jean-Charles le 06/08, en même temps que l'inversion géographique
// du socle. Ces chiffres ne sont plus provisoires : les changer est une décision produit, pas
// un ajustement. Un seul endroit à modifier.
export const BONUS: Record<BonusKey, number> = {
  coordination: 7, // exercice coordonné (MSP / CDS / ESP)
  logement:     5,
  vehicule:     4,
  secretariat:  4,
};

// Pourquoi la coordination devant les trois autres : logement, véhicule et secrétariat sont des
// conditions matérielles, valables le temps de la mission. L'exercice coordonné change ce que le
// kiné a le DROIT de faire — accès direct sans prescription, jusqu'à 8 séances (Avenant 7) — et
// reste un acquis de pratique après la mission. Ce n'est pas du même ordre qu'un confort.
//
// Logement devant véhicule et secrétariat : en Guadeloupe c'est le premier blocage concret pour
// un remplaçant venu de l'extérieur. Véhicule et secrétariat à égalité, l'un levant une
// contrainte de déplacement, l'autre une charge administrative.

export const BONUS_BUDGET = Object.values(BONUS).reduce((a, b) => a + b, 0);

export type WeightProfile = SocleProfile & Record<BonusKey, number>;

export function socleFor(missionType?: string | null): { socle: SocleProfile; label: string } {
  if (missionType === "ASSISTANAT")    return { socle: SOCLE_ASSISTANAT,    label: "ASSISTANAT" };
  if (missionType === "COLLABORATION") return { socle: SOCLE_COLLABORATION, label: "COLLABORATION" };
  return { socle: SOCLE_REMPLACEMENT, label: "REMPLACEMENT" };
}

// Barèmes d'AVANT la renormalisation (section 120). Conservés pour une seule raison : relire les
// scoreDetails déjà en base, qui ne portent pas de socleMax. Ne pas s'en servir pour calculer.
const LEGACY_WEIGHTS: Record<string, SocleProfile> = {
  REMPLACEMENT:  { dates: 35, geo: 25, bio: 20 },
  COLLABORATION: { dates: 40, geo: 30, bio: 30 },
  ASSISTANAT:    { dates: 20, geo: 25, bio: 55 },
};

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

// Libellés des bonus acquis. Celui de la coordination NOMME L'AVANTAGE au lieu du dispositif :
// « MSP » ne dit rien à qui n'y a jamais exercé, « accès direct » dit exactement ce qu'on y gagne.
const MENTIONS_BONUS: Record<BonusKey, string> = {
  logement:     "Logement proposé",
  vehicule:     "Véhicule proposé",
  secretariat:  "Secrétariat sur place",
  coordination: "Exercice coordonné — accès direct sans prescription",
};

function ton(val: number, max: number): Ton {
  if (max <= 0) return "moyen";
  const r = val / max;
  return r >= 0.75 ? "fort" : r >= 0.4 ? "moyen" : "faible";
}

// Traduit un scoreDetails stocké en mentions lisibles. Tolère les anciennes lignes : clés
// manquantes, ancienne composante « desirability » ignorée, et surtout absence de socleMax —
// auquel cas on retombe sur les barèmes d'avant la renormalisation, sans quoi les scores déjà
// enregistrés paraîtraient plus faibles qu'ils ne l'étaient.
export function lectureQualitative(details: Record<string, number | string> | null | undefined): Mention[] {
  if (!details) return [];
  const profKey = typeof details.profile === "string" ? details.profile : "REMPLACEMENT";
  const { socle } = socleFor(profKey);
  const mentions: Mention[] = [];

  const socleMax = Number(details.socleMax);
  const legacy = !Number.isFinite(socleMax);
  const bareme = legacy ? (LEGACY_WEIGHTS[profKey] ?? LEGACY_WEIGHTS.REMPLACEMENT) : socle;
  const echelle = legacy ? 1 : socleMax / 100;

  for (const cle of ["dates", "geo", "bio"] as const) {
    const val = Number(details[cle] ?? NaN);
    if (!Number.isFinite(val)) continue;
    const t = ton(val, bareme[cle] * echelle);
    mentions.push({ cle, texte: MENTIONS[cle][t === "fort" ? 0 : t === "moyen" ? 1 : 2], ton: t });
  }

  // Avantages : mentionnés seulement quand ils sont ACQUIS — une absence de logement n'est pas
  // un défaut de compatibilité, c'est simplement l'ordinaire. Un critère non demandé par le
  // candidat vaut 0 ici comme un critère demandé mais non proposé : dans les deux cas, rien à dire.
  for (const cle of ["coordination", "logement", "vehicule", "secretariat"] as const) {
    if (Number(details[cle] ?? 0) > 0) mentions.push({ cle, texte: MENTIONS_BONUS[cle], ton: "fort" });
  }

  return mentions;
}
