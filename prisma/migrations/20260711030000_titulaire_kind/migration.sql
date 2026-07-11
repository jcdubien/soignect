-- CreateEnum TitulaireKind (idempotent)
DO $$ BEGIN
  CREATE TYPE "TitulaireKind" AS ENUM ('CABINET', 'STRUCTURE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable Profile — distinction explicite Cabinet/Structure
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "titulaireKind" "TitulaireKind" NOT NULL DEFAULT 'CABINET';

-- Backfill : les titulaires marqués employeur deviennent des structures
UPDATE "Profile" SET "titulaireKind" = 'STRUCTURE' WHERE "isEmployeur" = true AND "titulaireKind" = 'CABINET';
