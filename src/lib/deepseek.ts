// ── Système de scoring affinité 0-100 (Sprint 3) ─────────────────────────────

import { zoneOfCommune, type ZoneGeo } from "@/lib/communes";
import { socleFor, BONUS, type BonusKey } from "@/lib/compatibilite";

export interface AffinityInput {
  bioTinder?: string | null;
  bio?: string | null;
  specialties?: string[];
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  minMonths?: number | null;
  location?: string | null;
  zones?: string[] | null; // Macro-zones souhaitées/couvertes (section 138)
  dateFlexibility?: number; // 0=exact, 1=±3j, 2=±1sem, 3=±2sem, 4=±1mois
  // Section 120 — pondération différenciée par type de poste + logement structuré
  missionType?: string;        // porté par la Mission (REMPLACEMENT | ASSISTANAT | COLLABORATION)
  // ── Offres, portées par la Mission du pourvoyeur ──
  logementPropose?: boolean;   // logement proposé
  vehiculePropose?: boolean;   // véhicule mis à disposition (feature terrain)
  secretairePresente?: boolean;// secrétariat présent au cabinet (section 190)
  exerciceCoordonne?: boolean; // MSP / centre de santé / ESP (section 190)
  // ── Demandes, portées par le Profil du chercheur ──
  rechercheLogement?: boolean;
  rechercheVehicule?: boolean;
  rechercheSecretariat?: boolean;
  rechercheExerciceCoordonne?: boolean;
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
    secretariat: number;
    coordination: number;
    // Plafond effectif du socle après renormalisation (100 − bonus en jeu). Sans lui, la lecture
    // qualitative ne peut pas savoir sur quelle échelle « dates: 24 » doit être jugé.
    socleMax: number;
  };
}

// Barèmes et sélection du profil de pondération : lib/compatibilite (partagé avec l'interface,
// qui en dérive sa lecture qualitative — un seul endroit où les poids sont écrits).
//
// La DÉSIRABILITÉ N'EST PLUS UNE COMPOSANTE DU SCORE. Elle mesurait le statut commercial de
// l'annonceur — abonnement, cabinet fondateur, partenaire, rééquilibrage géographique — c'est-à-dire
// une propriété du vendeur, pas de l'accord entre deux personnes. Un nombre présenté comme une
// « compatibilité » ne doit affirmer que ce qu'il mesure : à 10-15 points sur 100, elle rendait le
// chiffre partiellement faux, et le masquer n'y aurait rien changé. Elle vit désormais dans l'ORDRE
// D'AFFICHAGE du feed (voir api/feed et lib/desirability), énoncé en clair aux utilisateurs.

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
  // Le type de poste vient de l'annonce swipée, mais une disponibilité de candidat en porte un
  // aussi : on retombe sur celui du swipeur quand la mission n'en déclare pas.
  const { socle, label } = socleFor(mission.missionType ?? swiper.missionType);

  // ── UN SCORE PAR PAIRE, PAS UN PAR SENS DE SWIPE ────────────────────────────────────────
  //
  // Les champs sont ORIENTÉS : « propose » n'existe que sur une annonce de cabinet, « recherche »
  // que sur un profil de candidat. L'ancienne lecture ne regardait l'offre que du côté `mission`
  // et la demande que du côté `swiper` : quand le CABINET swipait la disponibilité d'un candidat,
  // les deux étaient vides et les quatre bonus tombaient à zéro. Le cabinet ne pouvait alors pas
  // dépasser 80/100 sur un remplaçant — plafond structurel invisible, constaté sur les données
  // réelles (Julien notait Jean-Charles 78, Jean-Charles notait Julien 23).
  //
  // On lit donc chaque critère des DEUX côtés : peu importe qui swipe, l'offre est là où elle est.
  const offre   = (k: "logementPropose" | "vehiculePropose" | "secretairePresente" | "exerciceCoordonne") =>
    Boolean(mission[k] || swiper[k]);
  const demande = (k: "rechercheLogement" | "rechercheVehicule" | "rechercheSecretariat" | "rechercheExerciceCoordonne") =>
    Boolean(swiper[k] || mission[k]);

  const CRITERES: { cle: BonusKey; offre: boolean; demande: boolean }[] = [
    { cle: "logement",     offre: offre("logementPropose"),    demande: demande("rechercheLogement") },
    { cle: "vehicule",     offre: offre("vehiculePropose"),    demande: demande("rechercheVehicule") },
    { cle: "secretariat",  offre: offre("secretairePresente"), demande: demande("rechercheSecretariat") },
    { cle: "coordination", offre: offre("exerciceCoordonne"),  demande: demande("rechercheExerciceCoordonne") },
  ];

  // ── RENORMALISATION ─────────────────────────────────────────────────────────────────────
  //
  // Un critère n'entre au barème QUE SI le chercheur l'exprime. Non demandé, son poids retourne
  // au socle plutôt que de laisser un trou : un candidat qui n'a pas besoin de logement n'est pas
  // moins compatible qu'un autre, alors qu'il perdait 10 points auparavant.
  //
  // Demandé mais non proposé, en revanche, le critère reste au barème et vaut 0 — là, l'écart
  // est réel : la personne veut quelque chose que ce cabinet n'offre pas.
  const enJeu = CRITERES.filter((c) => c.demande);
  const budgetActif = enJeu.reduce((s, c) => s + BONUS[c.cle], 0);
  const socleMax = 100 - budgetActif;
  const echelle = socleMax / 100;

  const datesRaw = scoreDates(mission, swiper);                             // 0-35
  const geoRaw   = scoreGeo(swiper, mission);                              // 0-25
  const bioRaw   = await scoreBio(swiper, mission, options?.skipDeepSeek);  // 0-30

  const dates = Math.round((datesRaw / 35) * socle.dates * echelle);
  const geo   = Math.round((geoRaw   / 25) * socle.geo   * echelle);
  const bio   = Math.round((bioRaw   / 30) * socle.bio   * echelle);

  const acquis = (cle: BonusKey) => {
    const c = CRITERES.find((x) => x.cle === cle)!;
    return c.demande && c.offre ? BONUS[cle] : 0;
  };
  const logement     = acquis("logement");
  const vehicule     = acquis("vehicule");
  const secretariat  = acquis("secretariat");
  const coordination = acquis("coordination");

  // Socle et bonus en jeu somment exactement 100 ; le clamp reste une ceinture de sécurité en
  // cas d'évolution des barèmes.
  const total = Math.min(100, dates + geo + bio + logement + vehicule + secretariat + coordination);

  return {
    total,
    weightProfile: label,
    details: { dates, geo, bio, logement, vehicule, secretariat, coordination, socleMax },
  };
}
