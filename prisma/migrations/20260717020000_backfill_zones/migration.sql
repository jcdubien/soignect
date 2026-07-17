-- Backfill des zones géographiques sur les annonces existantes (section 138).
-- Dérive zones = [zone(location)] pour les Missions dont zones est vide et dont la
-- commune est reconnue (jointure CommuneZone = matérialisation de zoneOfCommune()).
-- Idempotent : ne touche que les zones vides ; les communes non mappées (ex. données
-- de test comme un nom saisi à la place d'une commune) sont ignorées, pas de backfill
-- silencieux erroné.
UPDATE "Mission" AS m
SET "zones" = ARRAY[cz."zone"]::"ZoneGeographique"[]
FROM "CommuneZone" AS cz
WHERE m."location" = cz."commune"
  AND array_length(m."zones", 1) IS NULL;
