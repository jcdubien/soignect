-- Champs issus de l'analyse d'annonces réelles (groupe Facebook kinés Guadeloupe) : véhicule
-- mis à disposition, demi-journées libres/semaine, CA mensuel estimé. Additif — colonnes
-- nouvelles, sans impact sur les données existantes (IF NOT EXISTS = rejouable).
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "vehiculePropose"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "demiJourneesLibres" INTEGER;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "caMensuelEstime"    INTEGER;

-- Symétrique candidat de vehiculePropose (comme rechercheLogement l'est de logementPropose).
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rechercheVehicule"  BOOLEAN NOT NULL DEFAULT false;
