import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer must run as an external server package (not webpack-bundled),
  // otherwise its internal React reconciler loses the React.Component constructor at
  // runtime → "Component is not a constructor" on renderToBuffer.
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // Requis en Next 14 pour charger src/instrumentation.ts (init Sentry par runtime).
    instrumentationHook: true,
    // Inclut les documents légaux (.md, lus via fs) dans le bundle serverless Vercel
    // pour les routes qui les rendent (sinon ENOENT en prod). Section 150.
    outputFileTracingIncludes: {
      "/mentions-legales": ["./mentions-legales.md"],
      "/confidentialite": ["./politique-confidentialite.md"],
      "/cgu": ["./cgu-cgv.md"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "uploadthing.com" },
    ],
  },
};

// Wrap Sentry : instrumente automatiquement les routes/erreurs. Sans SENTRY_AUTH_TOKEN,
// l'upload de source maps est simplement ignoré (le build réussit). `silent` garde les
// logs Vercel propres. Aucun DSN requis au build : le SDK reste inerte tant qu'il manque.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    // Sans token d'upload : on ne génère PAS de source maps (sinon elles seraient servies
    // publiquement). Avec token : on les upload puis on les supprime du bundle servi.
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
