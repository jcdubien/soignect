// Repli du produit ENTIER : toute route sans image propre herite de celle-ci — accueil, connexion, inscription, pages legales. Elles n'en avaient aucune.
//
import { ogPage, OG_SIZE } from "@/lib/ogPage";

export const runtime = "edge"; // aucun accès base : rendu au plus près, sans démarrage Node
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Soignect — la mise en relation des professionnels de santé";

export default function Image() {
  return ogPage({
    // NEUTRE depuis l'ouverture aux autres professions (section 294). C'est l'image de repli
    // du produit ENTIER — accueil, connexion, inscription, pages légales : un infirmier qui
    // reçoit un lien Soignect y lisait « le job board des kinés ». Les pages de diffusion
    // kiné, elles, gardent leur propre image et leur propre mot : elles s'adressent aux kinés
    // par construction, jusque dans leur URL.
    titre: "Le job board des professionnels de santé en Guadeloupe",
    sousTitre: "Remplacement, assistanat, collaboration, salariat. Cabinets et candidats se trouvent en quelques swipes.",
  });
}
