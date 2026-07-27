-- Élargit bioTinder 280 -> 700 caractères (aligne la colonne sur bioLimitFor cabinet=700,
-- section 123/186). Un cabinet pouvait saisir jusqu'à 700 (zod max 700) alors que la colonne
-- plafonnait à 280 -> P2000 "value too long" à l'inscription / création d'annonce.
-- Widening VARCHAR : changement de métadonnée instantané en Postgres, non destructif, idempotent.
ALTER TABLE "Profile" ALTER COLUMN "bioTinder" TYPE VARCHAR(700);
ALTER TABLE "Mission" ALTER COLUMN "bioTinder" TYPE VARCHAR(700);
