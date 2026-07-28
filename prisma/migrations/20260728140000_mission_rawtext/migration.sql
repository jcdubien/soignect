-- Texte libre de l'annonce (refonte saisie texte-libre + extraction IA). Additif — colonne TEXT
-- nullable, sans impact sur les données existantes (IF NOT EXISTS = rejouable).
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "rawText" TEXT;
