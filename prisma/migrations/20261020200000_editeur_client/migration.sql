-- Éditeurs nommés d'un client institutionnel (20/10, section 314).
CREATE TABLE "EditeurClient" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nom" VARCHAR(120) NOT NULL,
  "fonction" VARCHAR(120),
  "ajouteParId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retireLe" TIMESTAMP(3),
  CONSTRAINT "EditeurClient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EditeurClient_clientId_userId_key" ON "EditeurClient"("clientId", "userId");
ALTER TABLE "EditeurClient" ADD CONSTRAINT "EditeurClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientInstitutionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditeurClient" ADD CONSTRAINT "EditeurClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditeurClient" ENABLE ROW LEVEL SECURITY;
