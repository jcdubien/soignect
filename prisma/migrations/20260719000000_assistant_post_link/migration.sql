-- Rattachement compte ASSISTANT à un poste (section 153) — additif, idempotent.
ALTER TABLE "CabinetPost" ADD COLUMN IF NOT EXISTS "linkedUserId" TEXT;

-- Unicité : un compte User ne peut être rattaché qu'à UN SEUL poste à la fois.
-- (Index unique partiel : les NULL n'entrent pas dans l'unicité.)
CREATE UNIQUE INDEX IF NOT EXISTS "CabinetPost_linkedUserId_key"
  ON "CabinetPost" ("linkedUserId");

-- FK vers User (SET NULL si le compte est supprimé → le poste redevient non rattaché).
DO $$ BEGIN
  ALTER TABLE "CabinetPost"
    ADD CONSTRAINT "CabinetPost_linkedUserId_fkey"
    FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
