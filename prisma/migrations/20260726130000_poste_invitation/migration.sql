-- Invitation par email pour rattacher un poste à un futur compte assistant (section 187). Additif.
CREATE TABLE IF NOT EXISTS "PosteInvitation" (
  "id"            TEXT NOT NULL,
  "cabinetPostId" TEXT NOT NULL,
  "invitedEmail"  TEXT NOT NULL,
  "token"         TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PosteInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PosteInvitation_token_key" ON "PosteInvitation"("token");
CREATE INDEX IF NOT EXISTS "PosteInvitation_invitedEmail_idx" ON "PosteInvitation"("invitedEmail");
-- RLS deny-all pour l'API anon Supabase (Prisma bypasse en rôle postgres), cohérent enable-rls.sql
ALTER TABLE "PosteInvitation" ENABLE ROW LEVEL SECURITY;
