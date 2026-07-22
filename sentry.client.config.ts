// Sentry — monitoring d'erreurs côté navigateur (Sprint 0.3).
// Tant que NEXT_PUBLIC_SENTRY_DSN n'est pas renseigné (Vercel), le SDK est désactivé :
// aucun envoi, aucun impact runtime, le build ne casse jamais.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Pas de Session Replay pour l'instant (poids bundle + vie privée) — activable plus tard.
});
