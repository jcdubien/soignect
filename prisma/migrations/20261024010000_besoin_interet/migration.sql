-- Intérêt d'un soignant pour un besoin du territoire (24/10) — additive.
-- Appliquée à la main via `prisma db execute --url $DIRECT_URL`.
CREATE TABLE "BesoinInteret" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BesoinInteret_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BesoinInteret_besoinId_profileId_key" ON "BesoinInteret"("besoinId", "profileId");
CREATE INDEX "BesoinInteret_profileId_idx" ON "BesoinInteret"("profileId");
ALTER TABLE "BesoinInteret" ADD CONSTRAINT "BesoinInteret_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "BesoinTerritoire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BesoinInteret" ENABLE ROW LEVEL SECURITY;
