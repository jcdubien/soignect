import { ogPage, OG_SIZE } from "@/lib/ogPage";

export const runtime = "edge"; // aucun accès base : rendu au plus près, sans démarrage Node
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
