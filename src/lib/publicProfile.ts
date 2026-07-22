// Confidentialité des profils (audit permissions, section 165).
// Champs du Profile à NE JAMAIS exposer à un tiers ni dans le feed :
//  - Identité contractuelle : rpps / numeroOrdre / adresse / siret (PII, section 150)
//  - Facturation Stripe : stripeCustomerId / stripeSubscriptionId / billingTriggeredAt /
//    subscriptionPlan / paidUntil (isPaid, drapeau public, reste exposé)
//  - Internes de classement : weight / desirabilityScore / desirabilityOverride /
//    desirabilityExpiry / institutionalPartner / isFounding
//  - Lien d'authentification : userId
// Le PROPRIÉTAIRE (et l'admin) continuent de voir l'intégralité de LEUR profil.
export const SENSITIVE_PROFILE_FIELDS = [
  "userId",
  "rpps", "numeroOrdre", "adresse", "siret",
  "stripeCustomerId", "stripeSubscriptionId", "billingTriggeredAt", "subscriptionPlan", "paidUntil",
  "weight", "desirabilityScore", "desirabilityOverride", "desirabilityExpiry",
  "institutionalPartner", "isFounding",
] as const;

// Retire les champs sensibles d'un objet profil déjà chargé (non-propriétaire).
export function stripSensitiveProfile<T extends Record<string, unknown> | null | undefined>(
  profile: T,
): T {
  if (!profile) return profile;
  const clone: Record<string, unknown> = { ...profile };
  for (const f of SENSITIVE_PROFILE_FIELDS) delete clone[f];
  return clone as T;
}

// Nettoie les profils imbriqués d'une liste de missions (feed / GET /api/missions).
export function stripMissionProfiles<M extends { profile?: Record<string, unknown> | null }>(
  missions: M[],
): M[] {
  return missions.map((m) => (m.profile ? { ...m, profile: stripSensitiveProfile(m.profile) } : m));
}
