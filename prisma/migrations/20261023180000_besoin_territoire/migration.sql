-- Besoin du territoire (23/10) — additive : deux tables, trois types, aucune modification de l'existant.
-- Appliquée à la main via `prisma db execute --url $DIRECT_URL`, comme les précédentes.

-- CreateEnum
CREATE TYPE "NatureBesoin" AS ENUM ('INSTALLATION_LIBERALE', 'EXERCICE_MSP', 'VACATIONS', 'SALARIE');

-- CreateEnum
CREATE TYPE "StatutBesoin" AS ENUM ('BROUILLON', 'A_VALIDER', 'PUBLIE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "ActionBesoin" AS ENUM ('CREATION', 'MODIFICATION', 'DEMANDE_PUBLICATION', 'VALIDATION', 'REFUS', 'PUBLICATION', 'RENOUVELLEMENT', 'ARCHIVAGE');

-- CreateTable
CREATE TABLE "BesoinTerritoire" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "codeInsee" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "profession" "Profession" NOT NULL,
    "specialite" VARCHAR(80),
    "nature" "NatureBesoin" NOT NULL,
    "texte" VARCHAR(1000) NOT NULL,
    "proposition" VARCHAR(500),
    "statut" "StatutBesoin" NOT NULL DEFAULT 'BROUILLON',
    "publieLe" TIMESTAMP(3),
    "expireLe" TIMESTAMP(3),
    "valideLe" TIMESTAMP(3),
    "motifRefus" VARCHAR(300),
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BesoinTerritoire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalBesoin" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "besoinId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientNom" VARCHAR(200) NOT NULL,
    "codeInsee" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "profession" "Profession" NOT NULL,
    "action" "ActionBesoin" NOT NULL,
    "statutAvant" VARCHAR(20),
    "statutApres" VARCHAR(20) NOT NULL,
    "auteurId" TEXT,
    "auteurNom" VARCHAR(160) NOT NULL,
    "motif" VARCHAR(300),

    CONSTRAINT "JournalBesoin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BesoinTerritoire_statut_profession_idx" ON "BesoinTerritoire"("statut", "profession");

-- CreateIndex
CREATE INDEX "BesoinTerritoire_clientId_idx" ON "BesoinTerritoire"("clientId");

-- CreateIndex
CREATE INDEX "BesoinTerritoire_codeInsee_profession_idx" ON "BesoinTerritoire"("codeInsee", "profession");

-- CreateIndex
CREATE INDEX "JournalBesoin_clientId_createdAt_idx" ON "JournalBesoin"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalBesoin_besoinId_idx" ON "JournalBesoin"("besoinId");

-- AddForeignKey
ALTER TABLE "BesoinTerritoire" ADD CONSTRAINT "BesoinTerritoire_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientInstitutionnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Un seul besoin ACTIF par case (commune × profession × spécialité), toutes structures confondues
-- (premier arrivé). L'échéance n'est pas dans l'index : un besoin publié et échu est archivé
-- (lib/besoinTerritoireServeur) avant tout contrôle d'unicité.
CREATE UNIQUE INDEX "BesoinTerritoire_case_active_key" ON "BesoinTerritoire"
  ("codeInsee", "profession", (COALESCE(lower("specialite"), '')))
  WHERE "statut" IN ('A_VALIDER', 'PUBLIE');

-- AJOUT SEUL, comme JournalReglage.
CREATE FUNCTION "journal_besoin_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'JournalBesoin est en ajout seul : % refusé', TG_OP;
END;
$$;
CREATE TRIGGER "journal_besoin_pas_de_modification"
  BEFORE UPDATE OR DELETE ON "JournalBesoin"
  FOR EACH ROW EXECUTE FUNCTION "journal_besoin_ajout_seul"();
CREATE TRIGGER "journal_besoin_pas_de_vidage"
  BEFORE TRUNCATE ON "JournalBesoin"
  FOR EACH STATEMENT EXECUTE FUNCTION "journal_besoin_ajout_seul"();

ALTER TABLE "BesoinTerritoire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalBesoin" ENABLE ROW LEVEL SECURITY;
