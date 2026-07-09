import type { MetadataRoute } from "next";

// Web App Manifest (PWA) — icônes 192 / 512 pour "Ajouter à l'écran d'accueil".
// icon.png (192) est servi par Next depuis src/app/ ; icon-512.png depuis public/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Soignect — mise en relation des professionnels de santé",
    short_name: "Soignect",
    description: "Trouvez votre remplaçant ou votre cabinet en Guadeloupe.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0B3D5C",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
