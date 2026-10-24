-- Relation convenue hors Soignect (24/10) — additive, défaut false : aucune ligne existante ne change.
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "horsSoignect" BOOLEAN NOT NULL DEFAULT false;
