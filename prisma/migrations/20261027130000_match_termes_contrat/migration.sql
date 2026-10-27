-- Termes du contrat figés à la première signature (27/10). Additive : null pour tous les matchs existants.
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "termesContrat" TEXT;
