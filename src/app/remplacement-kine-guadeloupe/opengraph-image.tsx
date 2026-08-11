import { ogPage, OG_SIZE } from "@/lib/ogPage";

export const runtime = "edge"; // aucun accès base : rendu au plus près, sans démarrage Node
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Postes de kiné en Guadeloupe — Soignect";

export default function Image() {
  return ogPage({
    titre: "Postes de kiné en Guadeloupe",
    sousTitre: "Remplacements, assistanats et collaborations sur toute la Guadeloupe. Gratuit pour qui cherche un poste.",
    badge: "📍 Guadeloupe",
  });
}
