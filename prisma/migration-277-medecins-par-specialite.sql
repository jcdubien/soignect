-- Section 277 — « médecin » se scinde par spécialité.
--
-- POURQUOI RECRÉER LE TYPE PLUTÔT QU'AJOUTER DES VALEURS. Postgres sait ajouter une valeur à un
-- enum, pas en retirer une. Or `MEDECIN` doit PARTIR : laissée en place, elle désignerait « un
-- médecin, on ne sait pas lequel » à côté de dix valeurs qui, elles, nomment un marché. Une
-- valeur ambiguë survit toujours à la migration qui devait la remplacer.
--
-- SANS RISQUE DE DONNÉES, vérifié avant écriture : les trois colonnes de ce type
-- (Profile, PrioriteTerritoriale, DemandePriorite) ne contiennent que KINESITHERAPEUTE.
-- Aucune ligne ne porte MEDECIN — la conversion ne peut rien perdre.

BEGIN;

-- Le défaut référence l'ancien type : il bloque le changement de colonne tant qu'il tient.
ALTER TABLE "Profile" ALTER COLUMN "profession" DROP DEFAULT;

CREATE TYPE "Profession_new" AS ENUM (
  'KINESITHERAPEUTE',
  'INFIRMIER',
  'ORTHOPHONISTE',
  'SAGE_FEMME',
  -- Médecine de ville : le généraliste, puis les spécialités retenues comme les plus tendues.
  'MEDECIN_GENERALISTE',
  'MEDECIN_CARDIOLOGIE',
  'MEDECIN_DERMATOLOGIE',
  'MEDECIN_ENDOCRINOLOGIE',
  'MEDECIN_GYNECOLOGIE',
  'MEDECIN_OPHTALMOLOGIE',
  'MEDECIN_ORL',
  'MEDECIN_PEDIATRIE',
  'MEDECIN_PSYCHIATRIE',
  'MEDECIN_RHUMATOLOGIE'
);

ALTER TABLE "Profile"              ALTER COLUMN "profession" TYPE "Profession_new" USING ("profession"::text::"Profession_new");
ALTER TABLE "PrioriteTerritoriale" ALTER COLUMN "profession" TYPE "Profession_new" USING ("profession"::text::"Profession_new");
ALTER TABLE "DemandePriorite"      ALTER COLUMN "profession" TYPE "Profession_new" USING ("profession"::text::"Profession_new");

DROP TYPE "Profession";
ALTER TYPE "Profession_new" RENAME TO "Profession";

ALTER TABLE "Profile" ALTER COLUMN "profession" SET DEFAULT 'KINESITHERAPEUTE';

COMMIT;
