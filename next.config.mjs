import { withSentryConfig } from "@sentry/nextjs";

// ── REDIRECTION DU DOMAINE VERCEL (22/10, parcours établissement, point 5) ─────────────────
//
// `soignect.vercel.app` servait tout le site sans redirection. Le référencement n'en souffrait
// pas (la balise canonical pointe sur l'adresse publique), mais la session ne se partage pas
// entre deux domaines : un établissement inscrit sur vercel.app devait se reconnecter sur
// www.soignect.fr, où mènent tous les liens des emails.
//
// Cible : l'adresse publique, lue dans les MÊMES variables que lib/appUrl (AUTH_URL, puis
// NEXTAUTH_URL) — ce fichier .mjs ne peut pas importer le module TypeScript. Sans elle, pas de
// redirection : on ne devine pas un domaine.
//
// Hôte EXACT `soignect.vercel.app` : les aperçus Vercel (soignect-git-…) ne sont pas touchés.
// `/api/` et `/_next/` sont exclus : un webhook (Stripe), une tâche planifiée ou un rappel
// externe configuré sur vercel.app ne suit pas une redirection — il échouerait en silence.
// Les paramètres de l'adresse sont conservés.
const HOTE_VERCEL = "soignect.vercel.app";
const ADRESSE_PUBLIQUE = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
const redirigerVercel = /^https:\/\//.test(ADRESSE_PUBLIQUE) && new URL(ADRESSE_PUBLIQUE).host !== HOTE_VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    if (!redirigerVercel) return [];
    const has = [{ type: "host", value: HOTE_VERCEL }];
    return [
      { source: "/", has, destination: `${ADRESSE_PUBLIQUE}/`, permanent: true },
      { source: "/:chemin((?!api/|_next/).+)", has, destination: `${ADRESSE_PUBLIQUE}/:chemin`, permanent: true },
    ];
  },
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
