-- Partie remplacée distincte du titulaire du compte (27/10). Additive : null pour tous les matchs existants.
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "remplaceProfileId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Match" ADD CONSTRAINT "Match_remplaceProfileId_fkey" FOREIGN KEY ("remplaceProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
