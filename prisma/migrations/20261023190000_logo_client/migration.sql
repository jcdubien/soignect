-- Logo d'une structure (23/10) — additive : une colonne facultative, aucune donnée modifiée.
-- Appliquée à la main via `prisma db execute --url $DIRECT_URL`.
ALTER TABLE "ClientInstitutionnel" ADD COLUMN "logoUrl" TEXT;
