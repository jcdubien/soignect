-- Siège du titulaire (section 188). Additif et idempotent : aucune donnée existante touchée.
-- La reprise (création des sièges + rattachement des absences) est faite par le script
-- scripts/backfill-owner-seat.mjs, volontairement séparée pour être rejouable et vérifiable.
ALTER TABLE "CabinetPost" ADD COLUMN IF NOT EXISTS "isOwnerSeat" BOOLEAN NOT NULL DEFAULT false;

-- Un seul siège titulaire par cabinet. Index partiel : ne contraint que les lignes à true,
-- les postes ordinaires ne sont pas concernés.
CREATE UNIQUE INDEX IF NOT EXISTS "CabinetPost_ownerSeat_unique"
  ON "CabinetPost"("cabinetId") WHERE "isOwnerSeat" = true;
