import { ogPage } from "@/lib/ogPage";
import type { Porte, Profession, Territoire } from "@/lib/pagesDiffusion";

// Image de partage d'une page de diffusion composée par PagePorte (section 300).
//
// Ces pages déclaraient leur propre `openGraph` sans image : Next ne reprend alors PAS l'image du
// segment racine, et Facebook affichait un partage sans miniature. Chaque route porte donc son
// fichier opengraph-image, qui délègue ici — textes tirés de la porte, comme le reste de la page.
export function imagePorte(porte: Porte, p: Profession, t: Territoire) {
  return ogPage({ titre: porte.ogTitre(p, t), sousTitre: porte.ogSousTitre(p, t), badge: `📍 ${t.nom}` });
}

export function altPorte(porte: Porte, p: Profession, t: Territoire) {
  return `${porte.ogTitre(p, t)} — Soignect`;
}
