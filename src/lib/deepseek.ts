// ── Système de scoring affinité 0-100 (Sprint 3) ─────────────────────────────

export interface AffinityInput {
  bioTinder?: string | null;
  bio?: string | null;
  specialties?: string[];
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  minMonths?: number | null;
  location?: string | null;
  desirabilityScore?: number;
  dateFlexibility?: number; // 0=exact, 1=±3j, 2=±1sem, 3=±2sem, 4=±1mois
  // Section 120 — pondération différenciée par type de poste + logement structuré
  missionType?: string;        // porté par la Mission (REMPLACEMENT | ASSISTANAT | COLLABORATION)
  logementPropose?: boolean;   // Mission (annonce cabinet) : logement proposé
  rechercheLogement?: boolean; // Profil remplaçant : recherche un logement
}

export interface AffinityResult {
  total: number;
  weightProfile: string; // profil de pondération appliqué (REMPLACEMENT | ASSISTANAT)
  details: {
    dates: number;
    geo: number;
    bio: number;
    logement: number;
    desirability: number;
  };
}

// Deux profils de pondération (total 100), sélectionnés par Mission.type (section 120).
// Remplacement et Collaboration partagent le même profil ; Assistanat a le sien.
type WeightProfile = { dates: number; geo: number; bio: number; logement: number; desirability: number };
const WEIGHTS_REMPLACEMENT: WeightProfile = { dates: 35, geo: 25, bio: 20, logement: 10, desirability: 10 };
const WEIGHTS_ASSISTANAT:  WeightProfile = { dates: 15, geo: 20, bio: 40, logement: 10, desirability: 15 };

function weightsFor(missionType?: string): { w: WeightProfile; label: string } {
  return missionType === "ASSISTANAT"
    ? { w: WEIGHTS_ASSISTANAT, label: "ASSISTANAT" }
    : { w: WEIGHTS_REMPLACEMENT, label: "REMPLACEMENT" };
}

function toDate(v?: Date | string | null): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

// Algo section 25 — dates=35pts avec flexibilité slider
function scoreDates(mission: AffinityInput, profile: AffinityInput): number {
  const FLEX_DAYS = [0, 3, 7, 14, 30];
  const mFlex = FLEX_DAYS[Math.min(mission.dateFlexibility ?? 0, 4)];
  const pFlex = FLEX_DAYS[Math.min(profile.dateFlexibility ?? 0, 4)];
  const totalFlex = Math.max(mFlex, pFlex);
  const toleranceMs = totalFlex * 24 * 60 * 60 * 1000;

  const mS = toDate(mission.startDate), mE = toDate(mission.endDate);
  const pS = toDate(profile.startDate), pE = toDate(profile.endDate);

  if (mS && mE && pS && pE) {
    const overlapStart = Math.max(mS.getTime(), pS.getTime() - toleranceMs);
    const overlapEnd   = Math.min(mE.getTime(), pE.getTime() + toleranceMs);
    if (overlapEnd <= overlapStart) return 0;
    const overlap  = overlapEnd - overlapStart;
    const shortest = Math.min(mE.getTime() - mS.getTime(), pE.getTime() - pS.getTime());
    const ratio    = Math.min(overlap / shortest, 1);
    const flexBonus = totalFlex >= 14 ? 5 : 0;
    return Math.min(Math.round(ratio * 30) + flexBonus, 35);
  }
  // Fallback minMonths
  if (mission.minMonths && pS && pE) {
    const months = (pE.getTime() - pS.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.round(Math.min(months / mission.minMonths, 1) * 25);
  }
  if (profile.minMonths && mS && mE) {
    const months = (mE.getTime() - mS.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.round(Math.min(months / profile.minMonths, 1) * 25);
  }
  return 17; // neutre si aucune date renseignée
}

// Proximité géographique : 0-25 pts (section 64 — repondération)
function scoreGeo(a: AffinityInput, b: AffinityInput): number {
  if (!a.location || !b.location) return 12;
  return a.location.toLowerCase() === b.location.toLowerCase() ? 25 : 6;
}

// Bio DeepSeek : 0-30 pts (section 64 — repondération)
async function scoreBio(a: AffinityInput, b: AffinityInput): Promise<number> {
  const bioA = a.bioTinder ?? a.bio;
  const bioB = b.bioTinder ?? b.bio;
  if (!bioA || !bioB) return 15;
  try {
    const prompt = `Tu es un algorithme de matching professionnel.
Compare ces deux descriptions professionnelles et donne un score de 0 à 30
basé sur la compatibilité des valeurs, aspirations et recherches.
Réponds uniquement avec un entier entre 0 et 30, sans explication.

Profil A : "${bioA}"
Profil B : "${bioB}"`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 5,
      }),
    });
    if (!res.ok) return 15;
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const n = parseInt(data.choices[0]?.message?.content?.trim() ?? "15");
    return isNaN(n) ? 15 : Math.min(Math.max(n, 0), 30);
  } catch {
    return 15;
  }
}

// Pondération différenciée par type de poste (section 120). Chaque composante est
// calculée sur son barème brut historique (dates/35, geo/25, bio/30, desirability/10)
// puis normalisée et re-pondérée selon le profil du poste. Le calcul DeepSeek de la
// Bio n'est PAS modifié — seul son poids relatif change.
export async function computeAffinityScore(
  swiper: AffinityInput,
  mission: AffinityInput
): Promise<AffinityResult> {
  const { w, label } = weightsFor(mission.missionType);

  const datesRaw = scoreDates(mission, swiper);                             // 0-35
  const geoRaw   = scoreGeo(swiper, mission);                              // 0-25
  const bioRaw   = await scoreBio(swiper, mission);                        // 0-30
  const desirRaw = Math.min(Math.max(mission.desirabilityScore ?? 0, 0), 10); // 0-10

  const dates        = Math.round((datesRaw / 35) * w.dates);
  const geo          = Math.round((geoRaw   / 25) * w.geo);
  const bio          = Math.round((bioRaw   / 30) * w.bio);
  const desirability = Math.round((desirRaw / 10) * w.desirability);
  // Bonus logement binaire : plein si l'annonce propose un logement ET le remplaçant en cherche.
  const logement = (mission.logementPropose && swiper.rechercheLogement) ? w.logement : 0;

  return {
    total: dates + geo + bio + logement + desirability,
    weightProfile: label,
    details: { dates, geo, bio, logement, desirability },
  };
}

// ── Ancien système de scoring 0-1 (conservé pour compatibilité) ───────────────

export interface MatchFactors {
  availability: number;
  location: number;
  specialties: number;
  bio: number;
  [key: string]: number; // compatibilité Prisma Json field
}

export interface MatchScore {
  score: number;
  factors: MatchFactors;
}

export interface ScoringData {
  profileType: string;
  bio?: string | null;
  pitch?: string | null;
  specialties?: string[];
  startDate?: Date | null;
  endDate?: Date | null;
  minMonths?: number | null;
  location?: string | null;
}

export async function computeMatchScore(
  a: ScoringData,
  b: ScoringData
): Promise<MatchScore> {
  const formatDate = (d?: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : null;

  const describeAvailability = (data: ScoringData) => {
    if (data.startDate && data.endDate)
      return `du ${formatDate(data.startDate)} au ${formatDate(data.endDate)}`;
    if (data.startDate) return `à partir du ${formatDate(data.startDate)}`;
    if (data.minMonths) return `poste longue durée (${data.minMonths} mois min)`;
    return "non précisée";
  };

  const prompt = `Tu es un moteur de matching pour kinésithérapeutes en Guadeloupe.
Évalue la compatibilité entre deux annonces et retourne UNIQUEMENT un JSON valide.

Annonce A (${a.profileType}):
- Phrase clé: ${a.pitch ?? "non renseignée"}
- Bio: ${a.bio ?? "non renseignée"}
- Spécialités: ${(a.specialties ?? []).join(", ") || "non renseignées"}
- Disponibilité: ${describeAvailability(a)}
- Localisation: ${a.location ?? "non renseignée"}

Annonce B (${b.profileType}):
- Phrase clé: ${b.pitch ?? "non renseignée"}
- Bio: ${b.bio ?? "non renseignée"}
- Spécialités: ${(b.specialties ?? []).join(", ") || "non renseignées"}
- Disponibilité: ${describeAvailability(b)}
- Localisation: ${b.location ?? "non renseignée"}

Retourne ce JSON et rien d'autre (valeurs entre 0.0 et 1.0):
{"score":0.0,"factors":{"availability":0.0,"location":0.0,"specialties":0.0,"bio":0.0}}`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Accept-Encoding": "identity",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek HTTP ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned empty content");

  return JSON.parse(content) as MatchScore;
}
