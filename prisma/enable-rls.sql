-- ============================================================================
-- Sécurité — activation de Row-Level Security (RLS) sur toutes les tables public
-- ============================================================================
-- Contexte : Supabase expose une API PostgREST sur le schéma `public` accessible
-- avec la clé anon (NEXT_PUBLIC_SUPABASE_ANON_KEY, exposée au navigateur). Sans
-- RLS, les rôles `anon`/`authenticated` peuvent lire/écrire directement les tables
-- → alerte Advisor "rls_disabled_in_public" + fuite de données (email, passwordHash…).
--
-- L'app n'accède JAMAIS aux tables via l'API Supabase (tout passe par Prisma, rôle
-- `postgres` = propriétaire + BYPASSRLS). Activer la RLS SANS policy = deny-all pour
-- l'API anon, sans impact sur l'app ni sur `service_role` (qui bypass aussi la RLS).
--
-- Les migrations Prisma ne gèrent pas la RLS : REJOUER ce script après tout
-- `prisma migrate reset` ou déploiement sur une nouvelle base. Idempotent.
-- Exécution : psql "$DIRECT_URL" -f prisma/enable-rls.sql
-- ============================================================================

ALTER TABLE "public"."User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Profile"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Mission"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Swipe"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Match"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Message"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Rating"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CabinetRating"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RemplacantRating"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CabinetPost"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- CommuneAPL : données publiques de référence (APL par commune). RLS déjà activée
-- avec une policy de lecture publique — laissée telle quelle (lecture anon OK).
ALTER TABLE "public"."CommuneAPL"        ENABLE ROW LEVEL SECURITY;
