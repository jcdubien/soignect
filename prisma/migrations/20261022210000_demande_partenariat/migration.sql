-- Demande de partenariat (22/10) — formulaire public /partenaire.
CREATE TYPE "StatutPartenariat" AS ENUM ('NOUVELLE', 'CONVERTIE', 'CLASSEE');

CREATE TABLE "DemandePartenariat" (
    "id" TEXT NOT NULL,
    "type" "TypeInstitution" NOT NULL,
    "structure" VARCHAR(160) NOT NULL,
    "contactNom" VARCHAR(120) NOT NULL,
    "fonction" VARCHAR(120),
    "email" VARCHAR(200) NOT NULL,
    "telephone" VARCHAR(30),
    "communes" TEXT[],
    "professions" "Profession"[],
    "message" VARCHAR(1000),
    "source" VARCHAR(80),
    "statut" "StatutPartenariat" NOT NULL DEFAULT 'NOUVELLE',
    "clientId" TEXT,
    "traiteeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemandePartenariat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemandePartenariat_statut_createdAt_idx" ON "DemandePartenariat"("statut", "createdAt");
CREATE INDEX "DemandePartenariat_email_createdAt_idx" ON "DemandePartenariat"("email", "createdAt");

ALTER TABLE "DemandePartenariat" ENABLE ROW LEVEL SECURITY;
