-- Section 190 — Deux nouveaux critères de bonus au score de compatibilité.
--
-- Purement additif : quatre colonnes booléennes avec valeur par défaut. Aucune donnée existante
-- n'est touchée, aucune colonne supprimée ni renommée. Rejouable sans effet (IF NOT EXISTS).
--
-- À APPLIQUER AVANT LE DÉPLOIEMENT du code correspondant : les routes lisent ces colonnes, un
-- déploiement en avance de phase ferait échouer les requêtes Mission/Profile en production.
--
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/migration-190-bonus-secretariat-coordination.sql

-- Offres, portées par l'annonce du pourvoyeur
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "secretairePresente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "exerciceCoordonne"  BOOLEAN NOT NULL DEFAULT false;

-- Demandes, portées par le profil du chercheur
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rechercheSecretariat"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rechercheExerciceCoordonne" BOOLEAN NOT NULL DEFAULT false;
