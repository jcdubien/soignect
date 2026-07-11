-- AlterTable Profile — photos secondaires optionnelles (section 3)
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "secondaryPhotoUrl1" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "secondaryPhotoUrl2" TEXT;
