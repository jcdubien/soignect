// Sentry — monitoring d'erreurs côté edge runtime (middleware, routes edge).
// Désactivé tant que le DSN n'est pas fourni (voir sentry.client.config.ts).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
