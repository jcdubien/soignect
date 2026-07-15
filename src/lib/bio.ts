// Limite de caractères BioTinder différenciée par type de profil (section 123).
// Remplaçant/Assistant : 280 (colle au comportement naturel observé).
// Cabinet/Titulaire : 700 (les offres cabinet sont naturellement plus longues).
// S'applique à Profile.bioTinder ET Mission.bioTinder (la bio d'une annonce suit la
// règle du type de profil qui la publie).

export const BIO_LIMIT_TITULAIRE = 700;
export const BIO_LIMIT_DEFAULT = 280;

export function bioLimitFor(profileType?: string | null): number {
  return profileType === "TITULAIRE" ? BIO_LIMIT_TITULAIRE : BIO_LIMIT_DEFAULT;
}
