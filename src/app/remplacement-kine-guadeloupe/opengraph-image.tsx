import { ogPage, OG_SIZE } from "@/lib/ogPage";

// Runtime par défaut, PAS edge (23/10) : une route edge n'est jamais fabriquée au build, elle se
// recalculait à chaque appel (~1 s de CPU, relevé Vercel). Sans paramètre ni accès base, l'image
// est désormais produite une fois au build et servie comme un fichier statique.
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
