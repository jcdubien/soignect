-- Ouverture aux postes salariés pour candidats REMPLACANT/ASSISTANT (section 154) — additif.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "ouvertSalariat" BOOLEAN NOT NULL DEFAULT false;
