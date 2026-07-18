/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer must run as an external server package (not webpack-bundled),
  // otherwise its internal React reconciler loses the React.Component constructor at
  // runtime → "Component is not a constructor" on renderToBuffer.
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
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

export default nextConfig;
