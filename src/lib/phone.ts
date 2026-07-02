// Indicatifs pays pour les notifications téléphone (section 50-51)
export const PHONE_COUNTRIES = [
  { code: "GP", dial: "+590", label: "Guadeloupe" },
  { code: "MQ", dial: "+596", label: "Martinique" },
  { code: "GF", dial: "+594", label: "Guyane" },
  { code: "RE", dial: "+262", label: "La Réunion" },
  { code: "FR", dial: "+33",  label: "Métropole" },
] as const;

// Construit un numéro E.164 : indicatif + chiffres (sans le 0 initial)
export function toE164(countryCode: string, localNumber: string): string {
  const country = PHONE_COUNTRIES.find(c => c.code === countryCode) ?? PHONE_COUNTRIES[0];
  const digits = localNumber.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `${country.dial}${digits}` : "";
}

// Sépare un E.164 stocké en { country, local } pour pré-remplir un formulaire
export function splitE164(e164: string | null | undefined, knownCountry?: string | null): { country: string; local: string } {
  if (!e164) return { country: knownCountry ?? "GP", local: "" };
  // On teste les indicatifs du plus long au plus court pour éviter les collisions
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const match = sorted.find(c => e164.startsWith(c.dial));
  if (match) return { country: match.code, local: e164.slice(match.dial.length) };
  return { country: knownCountry ?? "GP", local: e164.replace(/^\+/, "") };
}
