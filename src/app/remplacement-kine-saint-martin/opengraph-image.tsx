import { ogPage, OG_SIZE } from "@/lib/ogPage";

// Runtime par défaut, PAS edge (23/10) : une route edge n'est jamais fabriquée au build, elle se
// recalculait à chaque appel (~1 s de CPU, relevé Vercel). Sans paramètre ni accès base, l'image
// est désormais produite une fois au build et servie comme un fichier statique.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Postes de kiné à Saint-Martin — Soignect";

export default function Image() {
  return ogPage({
    titre: "Postes de kiné à Saint-Martin",
    sousTitre: "Remplacements et postes durables publiés par les cabinets et les kinésithérapeutes.",
    badge: "📍 Saint-Martin",
  });
}
