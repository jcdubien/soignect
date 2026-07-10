# Variables d'environnement — checklist de vérification (Vercel)

Inventaire de **toutes** les variables lues par le code (`process.env`), le schéma
Prisma (`env(...)`) et NextAuth v5. À vérifier dans le dashboard Vercel
(Project → Settings → Environment Variables).

Généré depuis un `grep process.env` du projet. Ne contient aucune valeur secrète.

---

## 🔴 CRITIQUE — l'application ne démarre pas / auth cassée sans elles

| Variable | Rôle | Utilisée dans | Si absente |
|---|---|---|---|
| `DATABASE_URL` | Connexion Postgres (pooler Supabase) | `prisma/schema.prisma` | ❌ Aucune requête DB — app HS |
| `DIRECT_URL` | Connexion directe (migrations) | `prisma/schema.prisma` | ❌ `prisma migrate deploy` échoue |
| `AUTH_SECRET` | Chiffrement des sessions NextAuth v5 | NextAuth (implicite) | ❌ Connexion impossible en prod |
| `AUTH_URL` | URL de base (callbacks auth + liens emails) | `lib/auth`, `lib/email.ts`, `api/auth/forgot-password` | ⚠️ Liens/redirections cassés (fallback `NEXTAUTH_URL` puis `localhost`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Projet Supabase (storage) | `lib/supabase-admin.ts`, `lib/supabase-client.ts` | ❌ Upload photos/signatures HS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase (client) | `lib/supabase-client.ts` | ❌ Client Supabase HS |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur (bypass RLS) pour uploads | `lib/supabase-admin.ts` | ❌ Upload photo onboarding + signatures échoue |

## 🟠 IMPORTANT — fonctionnalité cœur dégradée (mais app fonctionne)

| Variable | Rôle | Utilisée dans | Si absente |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | Scoring d'affinité + analyse bio | `lib/deepseek.ts` | ⚠️ Scores retombent sur des valeurs neutres (matching dégradé) |
| `RESEND_API_KEY` | Emails transactionnels (reset MDP, mise en relation) | `lib/email.ts`, `api/auth/forgot-password` | ⚠️ **Emails silencieusement ignorés** — à vérifier en priorité |

## 🟡 OPTIONNEL — feature désactivée si absente, reste de l'app OK

| Variable | Rôle | Utilisée dans | Si absente |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Paiement abonnements Premium/Boost | `api/stripe/checkout`, `api/stripe/webhook` | Abonnements payants indisponibles |
| `STRIPE_WEBHOOK_SECRET` | Vérif signature webhook Stripe | `api/stripe/webhook` | Webhook rejeté |
| `STRIPE_PRICE_PREMIUM` | ID prix Stripe — plan Premium | `api/stripe/*` | Plan Premium non achetable |
| `STRIPE_PRICE_BOOST` | ID prix Stripe — plan Boost | `api/stripe/*` | Plan Boost non achetable |
| `ANS_API_KEY` | Vérification RPPS (Annuaire Santé) | `api/rpps/verify` | Vérification RPPS désactivée |

## ⚪ AUTOMATIQUE — géré par la plateforme, aucune action

| Variable | Rôle |
|---|---|
| `NODE_ENV` | Défini automatiquement par Vercel/Next (`production`) |
| `NEXTAUTH_URL` | Alias hérité (NextAuth v4) — fallback de `AUTH_URL`, souvent inutile sur Vercel |

---

### Point d'attention signalé
- **`RESEND_API_KEY`** n'est présente ni dans `.env` ni dans `.env.local` en local — à confirmer côté Vercel, sinon aucun email n'est envoyé (le code court-circuite proprement sans erreur).
- Les variables Stripe (`STRIPE_*`) et `ANS_API_KEY` ne sont pas non plus configurées en local — normal si ces features ne sont pas encore activées.
