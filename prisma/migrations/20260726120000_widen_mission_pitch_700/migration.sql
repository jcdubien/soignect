-- Élargit Mission.pitch 280 -> 700 (aligne sur bioLimitFor cabinet=700, zod POST max 700).
-- Le formulaire d'annonce cabinet envoie 'pitch' jusqu'à 700 car -> P2000 sur mission.create
-- quand >280. Widening VARCHAR : métadonnée instantanée, non destructif, idempotent.
ALTER TABLE "Mission" ALTER COLUMN "pitch" TYPE VARCHAR(700);
