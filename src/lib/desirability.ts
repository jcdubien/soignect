// Désirabilité — mise en avant COMMERCIALE d'une annonce (section 126).
//
// Elle ne dit rien de l'accord entre deux personnes : c'est le statut de l'annonceur
// (abonnement, cabinet fondateur, partenaire institutionnel, arbitrage admin). À ce titre elle
// n'entre PAS dans le score de compatibilité — un nombre présenté comme une compatibilité doit
// n'affirmer que ce qu'il mesure. Elle détermine l'ORDRE D'AFFICHAGE du feed, ce qui est une
// pratique légitime dès lors qu'elle est énoncée en clair aux utilisateurs (voir le feed).

export interface DesirabilityProfile {
  isFounding: boolean;
  desirabilityOverride: number | null;
  desirabilityExpiry: Date | null;
  desirabilityScore: number;
  subscriptionPlan?: string | null;
  institutionalPartner?: boolean | null;
}

// Désirabilité effective en POURCENTAGE 0-100.
export function getDesirabilityPercent(profile: DesirabilityProfile, now: Date = new Date()): number {
  // Cabinet fondateur (JCD) = 100 % fixe.
  if (profile.isFounding) return 100;
  // Override admin = priorité absolue (0-100 %), tant que non expiré.
  if (profile.desirabilityOverride !== null) {
    const expired = profile.desirabilityExpiry && profile.desirabilityExpiry <= now;
    if (!expired) return Math.min(Math.max(profile.desirabilityOverride, 0), 100);
  }
  // Sinon dérivé du plan (automatique) : Premium 50, Boost 80, Structure 50, Gratuit 0.
  // Un desirabilityScore stocké (boost admin ponctuel) prime s'il est supérieur.
  const byPlan =
    profile.subscriptionPlan === "BOOST" ? 80 :
    (profile.subscriptionPlan === "PREMIUM" || profile.subscriptionPlan === "STRUCTURE") ? 50 : 0;
  const cpts = profile.institutionalPartner ? 20 : 0; // partenaire CPTS (section 23) — +20 %
  return Math.min(Math.max(byPlan, profile.desirabilityScore ?? 0) + cpts, 100);
}
