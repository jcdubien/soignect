-- Réglages fins des cases prioritaires et journal en ajout seul (22/10, point 8).
ALTER TABLE "PrioriteTerritoriale" ADD COLUMN "niveauApl" INTEGER;
ALTER TABLE "PrioriteTerritoriale" ADD COLUMN "justification" VARCHAR(280);
-- Les lignes APL existantes ont été posées par le recalcul : leur niveau EST le niveau APL.
UPDATE "PrioriteTerritoriale" SET "niveauApl" = "niveau" WHERE "origine" = 'APL';

CREATE TYPE "ActionReglage" AS ENUM ('CREATION', 'MODIFICATION', 'RETRAIT');

CREATE TABLE "JournalReglage" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clientId" TEXT NOT NULL,
  "clientNom" VARCHAR(200) NOT NULL,
  "natureClient" VARCHAR(40) NOT NULL,
  "codeInsee" TEXT NOT NULL,
  "commune" TEXT NOT NULL,
  "profession" "Profession" NOT NULL,
  "action" "ActionReglage" NOT NULL,
  "origine" "OriginePriorite" NOT NULL,
  "niveauAvant" INTEGER,
  "niveauApres" INTEGER,
  "niveauApl" INTEGER,
  "justification" VARCHAR(280),
  "auteurId" TEXT,
  "auteurNom" VARCHAR(160) NOT NULL,
  "motif" VARCHAR(300),
  CONSTRAINT "JournalReglage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JournalReglage_clientId_createdAt_idx" ON "JournalReglage"("clientId", "createdAt");

-- AJOUT SEUL : toute modification ou suppression est refusée par la base elle-même, quel que
-- soit le client SQL (application, console Supabase, script).
CREATE FUNCTION "journal_reglage_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'JournalReglage est en ajout seul : % refusé', TG_OP;
END;
$$;
CREATE TRIGGER "journal_reglage_pas_de_modification"
  BEFORE UPDATE OR DELETE ON "JournalReglage"
  FOR EACH ROW EXECUTE FUNCTION "journal_reglage_ajout_seul"();
CREATE TRIGGER "journal_reglage_pas_de_vidage"
  BEFORE TRUNCATE ON "JournalReglage"
  FOR EACH STATEMENT EXECUTE FUNCTION "journal_reglage_ajout_seul"();

ALTER TABLE "JournalReglage" ENABLE ROW LEVEL SECURITY;
