-- Page hébergée d'un client institutionnel + origine des priorités (section 310). Idempotent.
DO $$ BEGIN
  CREATE TYPE "OriginePriorite" AS ENUM ('APL', 'DECLAREE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "PrioriteTerritoriale"
  ADD COLUMN IF NOT EXISTS "origine" "OriginePriorite" NOT NULL DEFAULT 'DECLAREE';

CREATE TABLE IF NOT EXISTS "PageClient" (
  "id"             TEXT NOT NULL,
  "clientId"       TEXT NOT NULL,
  "jetonPublic"    TEXT NOT NULL,
  "jetonEdition"   TEXT NOT NULL,
  "communes"       TEXT[],
  "professions"    "Profession"[],
  "messageAccueil" VARCHAR(700),
  "contact"        VARCHAR(200),
  "creeParId"      TEXT NOT NULL,
  "demo"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PageClient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PageClient_clientId_key" ON "PageClient"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "PageClient_jetonPublic_key" ON "PageClient"("jetonPublic");
CREATE UNIQUE INDEX IF NOT EXISTS "PageClient_jetonEdition_key" ON "PageClient"("jetonEdition");
DO $$ BEGIN
  ALTER TABLE "PageClient" ADD CONSTRAINT "PageClient_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "ClientInstitutionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Jetons d'accès : rien ne doit sortir par PostgREST avec la clé anon.
ALTER TABLE "public"."PageClient" ENABLE ROW LEVEL SECURITY;
