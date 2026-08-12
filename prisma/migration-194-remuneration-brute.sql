-- Section 194 — Rémunération brute mensuelle des postes salariés.
-- Purement additif, rejouable. À appliquer AVANT le déploiement du code correspondant.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "remunerationBrute" INTEGER;
