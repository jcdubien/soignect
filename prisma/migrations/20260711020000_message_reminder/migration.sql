-- AlterTable Message — rappel 24h (section 9)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
