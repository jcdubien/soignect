-- Section 242 — signature manuscrite conservée pour les prochains contrats.
-- Chemin dans le bucket PRIVÉ `signatures`, jamais une URL publique.
-- Nullable : null = la personne n'a pas coché la case, aucune signature conservée.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;
