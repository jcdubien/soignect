import { OG_SIZE } from "@/lib/ogPage";
import { imagePorte, altPorte } from "@/lib/ogPorte";
import { INFIRMIER, TERRITOIRES, PORTES } from "@/lib/pagesDiffusion";

// Runtime Node, pas edge : le module des pages lit les enums Prisma (section 300).
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = altPorte(PORTES.ETABLISSEMENT, INFIRMIER, TERRITOIRES.GUADELOUPE);

export default function Image() {
  return imagePorte(PORTES.ETABLISSEMENT, INFIRMIER, TERRITOIRES.GUADELOUPE);
}
