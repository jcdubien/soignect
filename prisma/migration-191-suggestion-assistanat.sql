-- Section 191 — Suggestion « poste long terme » pour les remplaçants qui en swipent déjà.
-- Additif, rejouable, aucune donnée touchée. À appliquer AVANT le déploiement.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "suggestionAssistanatVueAt" TIMESTAMP(3);
