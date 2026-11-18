-- Fin anticipée d'un contrat (18/11). Additive, nullable : à appliquer AVANT le déploiement du code
-- qui la lit (les requêtes Match sélectionnent tous les scalaires).
ALTER TABLE "Match" ADD COLUMN "finAnticipeeAt" TIMESTAMP(3);
