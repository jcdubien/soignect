-- Vitrine du territoire (02/11) — additive : deux tables, un type, aucune modification de l'existant.
-- Appliquée à la main via `prisma db execute --url $DIRECT_URL`, comme les précédentes.

CREATE TYPE "StatutVitrine" AS ENUM ('BROUILLON', 'A_VALIDER', 'PUBLIE', 'RETIREE');

CREATE TABLE "VitrineTerritoire" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accroche" VARCHAR(200) NOT NULL,
    "cadreDeVie" VARCHAR(1500),
    "offreSoins" VARCHAR(1500),
    "aidesInstallation" VARCHAR(1500),
    "photos" JSONB NOT NULL DEFAULT '[]',
    "statut" "StatutVitrine" NOT NULL DEFAULT 'BROUILLON',
    "publieLe" TIMESTAMP(3),
    "valideLe" TIMESTAMP(3),
    "motifRefus" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VitrineTerritoire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VitrineTerritoire_clientId_key" ON "VitrineTerritoire"("clientId");
ALTER TABLE "VitrineTerritoire" ADD CONSTRAINT "VitrineTerritoire_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientInstitutionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JournalVitrine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "clientNom" VARCHAR(200) NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "statutAvant" VARCHAR(20),
    "statutApres" VARCHAR(20) NOT NULL,
    "auteurId" TEXT,
    "auteurNom" VARCHAR(160) NOT NULL,
    "motif" VARCHAR(300),
    CONSTRAINT "JournalVitrine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JournalVitrine_clientId_createdAt_idx" ON "JournalVitrine"("clientId", "createdAt");

-- AJOUT SEUL, comme JournalBesoin.
CREATE FUNCTION "journal_vitrine_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'JournalVitrine est en ajout seul : % refusé', TG_OP;
END;
$$;
CREATE TRIGGER "journal_vitrine_pas_de_modification"
  BEFORE UPDATE OR DELETE ON "JournalVitrine"
  FOR EACH ROW EXECUTE FUNCTION "journal_vitrine_ajout_seul"();
CREATE TRIGGER "journal_vitrine_pas_de_vidage"
  BEFORE TRUNCATE ON "JournalVitrine"
  FOR EACH STATEMENT EXECUTE FUNCTION "journal_vitrine_ajout_seul"();

ALTER TABLE "VitrineTerritoire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalVitrine" ENABLE ROW LEVEL SECURITY;
