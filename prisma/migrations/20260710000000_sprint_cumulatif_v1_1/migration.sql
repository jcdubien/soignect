-- AlterEnum — nouveaux types de poste (section 1b / 5). Additif, valeurs existantes conservées.
ALTER TYPE "PostType" ADD VALUE IF NOT EXISTS 'TITULAIRE';
ALTER TYPE "PostType" ADD VALUE IF NOT EXISTS 'ASSOCIE';

-- AlterTable Mission — champs additifs (section 1c / 6)
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "matchedName" VARCHAR(120);
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "departureDate" TIMESTAMP(3);

-- CreateTable PlatformConfig (section 2)
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
    "id" TEXT NOT NULL,
    "freeAccessMode" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- Row-Level Security (deny-all API anon — voir prisma/enable-rls.sql)
ALTER TABLE "public"."PlatformConfig" ENABLE ROW LEVEL SECURITY;
