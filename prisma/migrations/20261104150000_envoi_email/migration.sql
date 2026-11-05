-- Journal des emails envoyés (04/11). Additive. Le code tolère son absence (l'écriture est dans un
-- try/catch qui ne bloque jamais un envoi) : l'ordre migration / déploiement n'est pas critique.
CREATE TABLE "EnvoiEmail" (
    "id" TEXT NOT NULL,
    "resendId" TEXT,
    "destinataire" TEXT NOT NULL,
    "sujet" VARCHAR(300) NOT NULL,
    "statut" TEXT NOT NULL,
    "erreur" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvoiEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnvoiEmail_destinataire_createdAt_idx" ON "EnvoiEmail"("destinataire", "createdAt");
CREATE INDEX "EnvoiEmail_createdAt_idx" ON "EnvoiEmail"("createdAt");

ALTER TABLE "public"."EnvoiEmail" ENABLE ROW LEVEL SECURITY;
