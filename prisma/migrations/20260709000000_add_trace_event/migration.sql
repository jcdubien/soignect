-- CreateTable
CREATE TABLE "TraceEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "missionId" TEXT,
    "matchId" TEXT,
    "commune" TEXT,
    "profession" TEXT,
    "missionType" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "TraceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraceEvent_eventType_commune_occurredAt_idx" ON "TraceEvent"("eventType", "commune", "occurredAt");

-- CreateIndex
CREATE INDEX "TraceEvent_commune_profession_occurredAt_idx" ON "TraceEvent"("commune", "profession", "occurredAt");

-- Row-Level Security (deny-all pour l'API PostgREST anon — voir prisma/enable-rls.sql)
ALTER TABLE "public"."TraceEvent" ENABLE ROW LEVEL SECURITY;
