-- Espace structure (section 379). Additive : l'île d'une structure partenaire et de sa demande —
-- GUADELOUPE pour toutes les lignes existantes, seules connues jusqu'ici.
ALTER TABLE "ClientInstitutionnel" ADD COLUMN IF NOT EXISTS "territoire" "Territoire" NOT NULL DEFAULT 'GUADELOUPE';
ALTER TABLE "DemandePartenariat" ADD COLUMN IF NOT EXISTS "territoire" "Territoire" NOT NULL DEFAULT 'GUADELOUPE';
