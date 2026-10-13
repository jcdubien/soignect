// ── LE JOUR DU PRODUIT EST CELUI DE LA GUADELOUPE (section 298) ──────────────────────────────
//
// Module sans dépendance, pour être lu côté serveur (prédicat du fil) ET côté navigateur (encart
// « Période écoulée » du Planning) : les deux doivent juger « échue » sur la même borne.
//
// `endDate` est stockée à 00:00 UTC du jour civil (vérifié le 13/10 : 64 dates sur 64). On la
// compare donc à 00:00 UTC du JOUR LOCAL — jamais à `setHours(0)`, qui prend le fuseau de la
// machine : UTC sur le serveur, où 20 h en Guadeloupe est déjà le lendemain.
const FUSEAU_PRODUIT = "America/Guadeloupe";

export function jourLocalUtc(instant: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU_PRODUIT }).format(instant);
  return new Date(`${ymd}T00:00:00.000Z`);
}
