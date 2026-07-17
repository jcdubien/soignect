-- AlterTable User — opt-out dédié pour la notification "annonce consultée"
-- (événement fréquent, coupable indépendamment du consentement email global).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyConsultation" BOOLEAN NOT NULL DEFAULT true;
