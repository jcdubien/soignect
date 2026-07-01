-- Sprint 2 — Matching & Désirabilité
-- Ajouts additifs uniquement, aucune suppression

-- Enum SubscriptionPlan
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PREMIUM', 'BOOST');

-- bioTinder sur Profile
ALTER TABLE "Profile" ADD COLUMN "bioTinder" VARCHAR(280);

-- Champs désirabilité sur Profile
ALTER TABLE "Profile" ADD COLUMN "desirabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Profile" ADD COLUMN "desirabilityOverride" DOUBLE PRECISION;
ALTER TABLE "Profile" ADD COLUMN "desirabilityExpiry" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Profile" ADD COLUMN "isFounding" BOOLEAN NOT NULL DEFAULT false;

-- bioTinder sur Mission
ALTER TABLE "Mission" ADD COLUMN "bioTinder" VARCHAR(280);

-- Score d'affinité sur Swipe
ALTER TABLE "Swipe" ADD COLUMN "affinityScore" DOUBLE PRECISION;
ALTER TABLE "Swipe" ADD COLUMN "scoreDetails" JSONB;
