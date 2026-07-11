-- AlterTable Profile — bascule individuelle vers le payant (section 99/100)
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "billingTriggeredAt" TIMESTAMP(3);

-- AlterTable TraceEvent — acteur (cabinet actif) pour le critère 2
ALTER TABLE "TraceEvent" ADD COLUMN IF NOT EXISTS "profileId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TraceEvent_profileId_eventType_occurredAt_idx"
  ON "TraceEvent"("profileId", "eventType", "occurredAt");
