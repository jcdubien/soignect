// ── Système de scoring affinité 0-100 (Sprint 3) ─────────────────────────────

import { zoneOfCommune, type ZoneGeo } from "@/lib/communes";

export interface AffinityInput {
  bioTinder?: string | null;
  bio?: string | null;
  specialties?: string[];
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  minMonths?: number | null;
  location?: string | null;
  zones?: string[] | null; // Macro-zones souhaitées/couvertes (section 138)
  desirabilityScore?: number;
  dateFlexibility?: number; // 0=exact, 1=±3j, 2=±1sem, 3=±2sem, 4=±1mois
  // Section 120 — pondération différenciée par type de poste + logement structuré
  missionType?: string;        // porté par la Mission (REMPLACEMENT | ASSISTANAT | COLLABORATION)
  logementPropose?: boolean;   // Mission (annonce cabinet) : logement proposé
  rechercheLogement?: boolean; // Profil remplaçant : recherche un logement
  vehiculePropose?: boolean;   // Mission (annonce cabinet) : véhicule mis à disposition (feature terrain)
  rechercheVehicule?: boolean; // Profil remplaçant : besoin d'un véhicule
}

export interface AffinityResult {
  total: number;
  weightProfile: string; // profil de pondération appliqué (REMPLACEMENT | ASSISTANAT)
  details: {
    dates: number;
    geo: number;
    bio: number;
    logement: number;
    vehicule: number;
    desirability: number;
  };
}

// Deux profils de pondération (total 100), sélectionnés par Mission.type (section 120).
// Remplacement et Collaboration partagent le même profil ; Assistanat a le sien.
type WeightProfile = { dates: number; geo: number; bio: number; logement: number; vehicule: number; desirability: number };
// 3 profils (section 120 corrigé + 126). Logement/véhicule UNIQUEMENT en Remplacement (0 ailleurs).
// Véhicule = bonus symétrique du logement (feature terrain). Le total peut atteindre 110 si un
// candidat cherche ET logement ET véhicule et que l'annonce propose les deux → clampé à 100 plus bas
// (voir computeAffinityScore) pour ne pas modifier le barème logement existant.
const WEIGHTS_REMPLACEMENT:  WeightProfile = { dates: 35, geo: 25, bio: 20, logement: 10, vehicule: 10, desirability: 10 };
const WEIGHTS_COLLABORATION: WeightProfile = { dates: 35, geo: 25, bio: 30, logement: 0,  vehicule: 0,  desirability: 10 };
const WEIGHTS_ASSISTANAT:    WeightProfile = { dates: 15, geo: 20, bio: 50, logement: 0,  vehicule: 0,  desirability: 15 };

function weightsFor(missionType?: string): { w: WeightProfile; label: string } {
  if (missionType === "ASSISTANAT")    return { w: WEIGHTS_ASSISTANAT,    label: "ASSISTANAT" };
  if (missionType === "COLLABORATION") return { w: WEIGHTS_COLLABORATION, label: "COLLABORATION" };
  return { w: WEIGHTS_REMPLACEMENT, label: "REMPLACEMENT" };
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

// Proximité géographique : 0-25 pts (section 64 — repondération, section 138 — zones).
// a = swiper (celui qui swipe), b = mission (annonce évaluée). Chacun porte une commune
// précise (location) et une liste de macro-zones souhaitées/couvertes (zones, multi).
// Match plein si l'un est dans la zone de recherche de l'autre, ou si les zones se
// chevauchent ; sinon repli sur l'égalité commune / même zone historique.
function scoreGeo(a: AffinityInput, b: AffinityInput): number {
  const aZone = zoneOfCommune(a.location);
  const bZone = zoneOfCommune(b.location);
  const aZones = (a.zones ?? []) as ZoneGeo[];
  const bZones = (b.zones ?? []) as ZoneGeo[];

  // Section 144 : la flexibilité géo n'existe que côté CANDIDAT (Disponibilite.zones) ;
  // le cabinet a une commune fixe. On vérifie donc si la commune (précise) d'une partie
  // tombe dans les zones souhaitées de l'AUTRE — jamais une comparaison zones↔zones.
  // 1) La commune de l'annonce évaluée (b) tombe dans une zone souhaitée par le swiper (a).
  if (bZone && aZones.includes(bZone)) return 25;
  // 2) La commune du swiper (a) tombe dans une zone souhaitée par l'annonce évaluée (b).
  if (aZone && bZones.includes(aZone)) return 25;

  // Repli historique commune (section 64) enrichi de la notion de zone.
  if (!a.location || !b.location) return 12;
  if (a.location.toLowerCase() === b.location.toLowerCase()) return 25;
  if (aZone && bZone && aZone === bZone) return 18; // communes différentes, même macro-zone
  return 6;
}

// Bio DeepSeek : 0-30 pts (section 64 — repondération)
// skipDeepSeek=true (plafond budget atteint, rate-limit section 165) → score neutre 15/30
// sans appel API, identique au repli d'erreur existant.
async function scoreBio(a: AffinityInput, b: AffinityInput, skipDeepSeek = false): Promise<number> {
  const bioA = a.bioTinder ?? a.bio;
  const bioB = b.bioTinder ?? b.bio;
  if (!bioA || !bioB) return 15;
  if (skipDeepSeek) return 15;
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
  mission: AffinityInput,
  options?: { skipDeepSeek?: boolean }
): Promise<AffinityResult> {
  const { w, label } = weightsFor(mission.missionType);

  const datesRaw = scoreDates(mission, swiper);                             // 0-35
  const geoRaw   = scoreGeo(swiper, mission);                              // 0-25
  const bioRaw   = await scoreBio(swiper, mission, options?.skipDeepSeek);  // 0-30
  // desirabilityScore est un POURCENTAGE 0-100 (section 126), appliqué au créneau du profil.
  const desirPercent = Math.min(Math.max(mission.desirabilityScore ?? 0, 0), 100);

  const dates        = Math.round((datesRaw / 35) * w.dates);
  const geo          = Math.round((geoRaw   / 25) * w.geo);
  const bio          = Math.round((bioRaw   / 30) * w.bio);
  const desirability = Math.round((desirPercent / 100) * w.desirability);
  // Bonus logement binaire, UNIQUEMENT en Remplacement (w.logement=0 pour Collab/Assistanat) :
  // plein si l'annonce propose un logement ET le remplaçant en cherche.
  const logement = (mission.logementPropose && swiper.rechercheLogement) ? w.logement : 0;
  // Bonus véhicule symétrique (feature terrain) : plein si l'annonce met un véhicule à disposition
  // ET le remplaçant en a besoin. Même structure binaire que le logement.
  const vehicule = (mission.vehiculePropose && swiper.rechercheVehicule) ? w.vehicule : 0;

  // Clamp à 100 : logement + véhicule peuvent cumuler jusqu'à 20 pts en Remplacement ; on borne
  // le total au barème /100 sans toucher au calcul du logement (details bruts conservés).
  const total = Math.min(100, dates + geo + bio + logement + vehicule + desirability);

  return {
    total,
    weightProfile: label,
    details: { dates, geo, bio, logement, vehicule, desirability },
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

// Score et facteurs sur 0-100, comme computeAffinityScore et comme tout ce que l'interface
// affiche. Le modèle, lui, répond sur 0.0-1.0 : la conversion se fait ici, une fois, au lieu
// d'être oubliée par chaque appelant. Match.aiScore a longtemps stocké du 0-1 brut, si bien
// qu'un 0,72 s'affichait « 1 » après arrondi — l'interface a fini par contourner le champ
// partout au profit de Swipe.affinityScore.
export interface MatchScore {
  score: number;
  factors: MatchFactors;
}

export interface ScoringData {
  profileType: string;
  bio?: string | null;
  pitch?: string | null;
  // L'accroche est le champ que les utilisateurs remplissent réellement — le scoring l'ignorait
  // et ne lisait que pitch/bio, souvent vides des deux côtés. Il évaluait donc deux annonces
  // sans texte, et le modèle rendait un verdict nul faute de matière.
  bioTinder?: string | null;
  specialties?: string[];
  startDate?: Date | null;
  endDate?: Date | null;
  minMonths?: number | null;
  location?: string | null;
}

export async function computeMatchScore(
  a: ScoringData,
  b: ScoringData,
  options?: { skipDeepSeek?: boolean }
): Promise<MatchScore | null> {
  // Repli budget (rate-limit section 165) : pas d'appel API, donc PAS de score. On renvoie
  // null — « inconnu » — et non un chiffre neutre inventé. Le repli précédent (0.5 sur une
  // échelle 0-1) devenait un score stocké, impossible à distinguer d'une vraie évaluation :
  // un couple non évalué s'affichait comme un couple médiocre.
  if (options?.skipDeepSeek) return null;

  const formatDate = (d?: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : null;

  const describeAvailability = (data: ScoringData) => {
    if (data.startDate && data.endDate)
      return `du ${formatDate(data.startDate)} au ${formatDate(data.endDate)}`;
    if (data.startDate) return `à partir du ${formatDate(data.startDate)}`;
    if (data.minMonths) return `poste longue durée (${data.minMonths} mois min)`;
    return "non précisée";
  };

  // Le texte est pris LÀ OÙ IL EST : l'accroche d'abord, qui est le champ réellement rempli.
  const presentation = (d: ScoringData) =>
    d.pitch ?? d.bioTinder ?? d.bio ?? "non renseignée";

  const bloc = (d: ScoringData, nom: string) => `Annonce ${nom} (${d.profileType}):
- Présentation: ${presentation(d)}
- Spécialités: ${(d.specialties ?? []).join(", ") || "non renseignées"}
- Disponibilité: ${describeAvailability(d)}
- Localisation: ${d.location ?? "non renseignée"}`;

  // Le gabarit de réponse ne doit PAS contenir de valeurs plausibles : donné avec des 0.0, il
  // était recopié tel quel dès que les annonces manquaient de texte — tous les scores sortaient
  // à zéro, verdict apparemment motivé mais qui n'évaluait rien. Des marqueurs <…> forcent le
  // modèle à produire ses propres nombres.
  const prompt = `Tu es un moteur de matching pour kinésithérapeutes en Guadeloupe.
Évalue la compatibilité entre ces deux annonces.

${bloc(a, "A")}

${bloc(b, "B")}

Réponds UNIQUEMENT par un objet JSON de cette forme, en remplaçant chaque <…> par ta propre
évaluation (nombre entre 0.0 et 1.0). N'utilise pas les valeurs de l'exemple :
{"score":<compatibilité globale>,"factors":{"availability":<recouvrement des périodes>,"location":<proximité géographique>,"specialties":<adéquation des spécialités>,"bio":<adéquation des profils>}}`;

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

  // Réponse du modèle : 0.0-1.0. On la valide avant de la croire — une valeur hors bornes
  // signale une réponse mal formée, pas une compatibilité nulle. Mieux vaut lever (l'appelant
  // laissera le score à « inconnu ») que d'enregistrer un zéro qui a l'air d'un verdict.
  const brut = JSON.parse(content) as { score?: unknown; factors?: Record<string, unknown> };
  const enPourcent = (v: unknown, champ: string): number => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`DeepSeek: ${champ} hors bornes 0-1 (${JSON.stringify(v)})`);
    }
    return Math.round(v * 100);
  };
  return {
    score: enPourcent(brut.score, "score"),
    factors: {
      availability: enPourcent(brut.factors?.availability, "factors.availability"),
      location:     enPourcent(brut.factors?.location,     "factors.location"),
      specialties:  enPourcent(brut.factors?.specialties,  "factors.specialties"),
      bio:          enPourcent(brut.factors?.bio,          "factors.bio"),
    },
  };
}
