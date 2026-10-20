-- Accord du client à la publication de son nom sur sa page (20/10).
CREATE TYPE "AccordClient" AS ENUM ('OUI', 'NON', 'DEMO');
ALTER TABLE "PageClient" ADD COLUMN "accord" "AccordClient" NOT NULL DEFAULT 'NON';
-- Une page de démonstration porte d'emblée l'accord DEMO ; les autres restent NON tant que
-- l'accord n'est pas noté.
UPDATE "PageClient" SET "accord" = 'DEMO' WHERE "demo" = true;
