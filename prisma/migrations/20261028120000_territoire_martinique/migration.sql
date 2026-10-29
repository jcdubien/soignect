-- Ouverture de la Martinique (section 376). Additive : trois zones de plus, un type, trois colonnes
-- avec défaut — GUADELOUPE / false pour tous les comptes et toutes les annonces existants.
ALTER TYPE "ZoneGeographique" ADD VALUE IF NOT EXISTS 'MARTINIQUE_CENTRE';
ALTER TYPE "ZoneGeographique" ADD VALUE IF NOT EXISTS 'MARTINIQUE_NORD';
ALTER TYPE "ZoneGeographique" ADD VALUE IF NOT EXISTS 'MARTINIQUE_SUD';
DO $$ BEGIN
  CREATE TYPE "Territoire" AS ENUM ('GUADELOUPE', 'MARTINIQUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "territoire" "Territoire" NOT NULL DEFAULT 'GUADELOUPE';
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "voirAutreTerritoire" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "territoire" "Territoire" NOT NULL DEFAULT 'GUADELOUPE';
