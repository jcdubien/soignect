CREATE TYPE "TrainingPurchaseStatus" AS ENUM ('PAID', 'ENROLLED', 'ENROLLMENT_FAILED');

CREATE TABLE "TrainingPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentId" TEXT,
    "amountTotal" INTEGER,
    "currency" TEXT,
    "moodleUserId" INTEGER,
    "moodleCourseId" INTEGER,
    "status" "TrainingPurchaseStatus" NOT NULL DEFAULT 'PAID',
    "lastError" VARCHAR(1000),
    "enrolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingPurchase_stripeSessionId_key" ON "TrainingPurchase"("stripeSessionId");
CREATE INDEX "TrainingPurchase_userId_courseKey_idx" ON "TrainingPurchase"("userId", "courseKey");
CREATE INDEX "TrainingPurchase_status_updatedAt_idx" ON "TrainingPurchase"("status", "updatedAt");

ALTER TABLE "TrainingPurchase" ADD CONSTRAINT "TrainingPurchase_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
