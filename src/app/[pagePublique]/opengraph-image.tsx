import { OG_SIZE, ogPage } from "@/lib/ogPage";
import { imagePorte, altPorte } from "@/lib/ogPorte";
import { PAGES_PUBLIEES, pagePublieeDuSlug, cleTracePage } from "@/lib/pagesDiffusion";

// Image de partage de chaque page de diffusion (section 300), textes tirés de sa porte.
// Runtime Node, pas edge : le registre lit les enums Prisma, et une route edge n'est jamais
// fabriquée au build (23/10, ~1 s de CPU par appel). Les chemins étant tous connus, chaque image
// est produite une fois au build et servie comme un fichier statique.
export const contentType = "image/png";
export const size = OG_SIZE;

export function generateStaticParams() {
  return PAGES_PUBLIEES.map((x) => ({ pagePublique: cleTracePage(x.porte, x.profession, x.territoire) }));
}

export async function generateImageMetadata({ params }: { params: { pagePublique: string } }) {
  const page = pagePublieeDuSlug(params.pagePublique);
  return [{ id: "partage", contentType, size, alt: page ? altPorte(page.porte, page.profession, page.territoire) : "Soignect" }];
}

export default function Image({ params }: { params: { pagePublique: string } }) {
  const page = pagePublieeDuSlug(params.pagePublique);
  return page ? imagePorte(page.porte, page.profession, page.territoire) : ogPage({ titre: "Soignect", sousTitre: "" });
}
