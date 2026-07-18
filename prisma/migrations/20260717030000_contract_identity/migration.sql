-- Identité contractuelle (section 150) — champs injectés dans le PDF de contrat,
-- obligatoires avant génération. Additif, idempotent.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rpps" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "numeroOrdre" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "adresse" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "siret" TEXT;

-- Flag de blocage dur (false = phase d'avertissement non bloquant).
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "enforceContractProfile" BOOLEAN NOT NULL DEFAULT false;
