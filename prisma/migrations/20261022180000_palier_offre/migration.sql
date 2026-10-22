-- Palier de l'offre rattaché à la structure, dont « partenaire fondateur » (22/10, point 9).
CREATE TYPE "PalierOffre" AS ENUM ('MSP', 'ETABLISSEMENT', 'CPTS', 'HOPITAL', 'PARTENAIRE_FONDATEUR');
ALTER TABLE "ClientInstitutionnel" ADD COLUMN "palier" "PalierOffre";
-- Journal : palier et gratuité au moment du réglage. Ajout de colonnes seulement — le
-- déclencheur d'ajout seul porte sur UPDATE/DELETE/TRUNCATE des lignes, pas sur le schéma.
ALTER TABLE "JournalReglage" ADD COLUMN "palier" VARCHAR(40);
ALTER TABLE "JournalReglage" ADD COLUMN "accesGratuit" BOOLEAN;
