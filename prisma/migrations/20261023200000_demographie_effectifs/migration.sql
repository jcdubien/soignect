-- Démographie et effectifs de santé par commune (23/10) — additive : deux tables de totaux
-- publics, aucune donnée personnelle. Appliquée à la main via `prisma db execute --url $DIRECT_URL`.
CREATE TABLE "DemographieCommune" (
    "codeInsee" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "millesime" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemographieCommune_pkey" PRIMARY KEY ("codeInsee")
);

CREATE TABLE "EffectifPraticiens" (
    "id" SERIAL NOT NULL,
    "codeInsee" TEXT NOT NULL,
    "profession" "Profession" NOT NULL,
    "effectif" INTEGER NOT NULL,
    "effectifLiberal" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "extraitLe" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EffectifPraticiens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EffectifPraticiens_codeInsee_profession_key" ON "EffectifPraticiens"("codeInsee", "profession");
CREATE INDEX "EffectifPraticiens_profession_idx" ON "EffectifPraticiens"("profession");

ALTER TABLE "DemographieCommune" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EffectifPraticiens" ENABLE ROW LEVEL SECURITY;
