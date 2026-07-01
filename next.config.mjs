/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer must run as an external server package (not webpack-bundled),
  // otherwise its internal React reconciler loses the React.Component constructor at
  // runtime → "Component is not a constructor" on renderToBuffer.
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "uploadthing.com" },
    ],
  },
};

export default nextConfig;
