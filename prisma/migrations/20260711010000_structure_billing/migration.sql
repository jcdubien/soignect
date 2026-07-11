-- AlterEnum — plan Structure privée (section 7)
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'STRUCTURE';

-- AlterTable Profile — identifiants Stripe pour le metered billing
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
