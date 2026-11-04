-- Mise en avant payante des postes salariés (étape 6, 04/11). Additive : une colonne éteinte par
-- défaut et une table. À appliquer en production AVANT le déploiement du code (le fil lit la
-- colonne).
ALTER TABLE "PlatformConfig" ADD COLUMN "miseEnAvantPosteSalarie" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MiseEnAvantPoste" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "creeParUserId" TEXT NOT NULL,
    "retireeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiseEnAvantPoste_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MiseEnAvantPoste_missionId_fin_idx" ON "MiseEnAvantPoste"("missionId", "fin");

ALTER TABLE "MiseEnAvantPoste" ADD CONSTRAINT "MiseEnAvantPoste_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."MiseEnAvantPoste" ENABLE ROW LEVEL SECURITY;
