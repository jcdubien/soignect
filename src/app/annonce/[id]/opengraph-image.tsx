import { rendreVignetteJpeg, ErreurRenduVignette, TAILLE_VIGNETTE } from "@/lib/vignetteAnnonce";

// ── REPLI DE LA VIGNETTE DE PARTAGE (section 285) ────────────────────────────────────────────
//
// Le rendu vit désormais dans `lib/vignetteAnnonce` et s'exécute À LA PUBLICATION, une fois par
// annonce. Cette route reste le chemin de SECOURS, servi dans deux cas :
//
//   1. une annonce dont la vignette n'a pas encore été générée (ancienne, ou génération en
//      échec) — `generateMetadata` ne pointe vers le stockage que si `vignetteAt` est posé ;
//   2. les aperçus DÉJÀ SCRAPÉS par Facebook, qui pointent sur cette URL. La supprimer les
//      casserait, et c'est la page la plus partagée du produit.
//
// Elle n'est donc pas du code mort : elle est la garantie qu'aucun partage ne se retrouve sans
// image, y compris pendant la bascule.
export const runtime = "nodejs"; // accès Prisma (DB) → runtime Node, pas edge
export const size = TAILLE_VIGNETTE;
export const contentType = "image/jpeg";
export const alt = "Annonce Soignect";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let jpeg;
  try {
    jpeg = await rendreVignetteJpeg(id);
  } catch (e) {
    if (e instanceof ErreurRenduVignette) {
      // Surtout PAS 404 : les caches sociaux retiennent longtemps un 404 et l'aperçu resterait
      // cassé pour une annonce pourtant valide. 503 = temporaire, le scraper réessaiera.
      return new Response("Image de partage temporairement indisponible", { status: 503 });
    }
    throw e;
  }

  // Pas d'annonce publique → 404, cohérent avec /annonce/[id] qui renvoie notFound().
  if (!jpeg) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      // Conservé tel quel. Mesuré le 07/10 : il ne suffit pas — 251 requêtes CDN pour 246
      // invocations, les robots sociaux scrapant depuis des points de présence distincts dont
      // chacun a son cache. C'est précisément ce que la génération à la publication corrige ;
      // cet en-tête ne protège plus que le repli.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
