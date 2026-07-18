-- Consentement légal à l'inscription (section 150) — horodatage additif, idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "acceptedTermsAt" TIMESTAMP(3);
