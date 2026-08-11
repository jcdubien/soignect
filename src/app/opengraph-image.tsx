// Repli du produit ENTIER : toute route sans image propre herite de celle-ci — accueil, connexion, inscription, pages legales. Elles n'en avaient aucune.
//
import { ogPage, OG_SIZE } from "@/lib/ogPage";

export const runtime = "edge"; // aucun accès base : rendu au plus près, sans démarrage Node
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Soignect — la mise en relation des professionnels de santé";

export default function Image() {
  return ogPage({
    titre: "Le job board des kinés de Guadeloupe",
    sousTitre: "Remplacement, assistanat, collaboration, salariat. Cabinets et candidats se trouvent en quelques swipes.",
  });
}
