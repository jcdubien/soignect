import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";
import { rendreVignetteJpeg, ErreurRenduVignette, TAILLE_VIGNETTE } from "@/lib/vignetteAnnonce";
import { urlVignette } from "@/lib/vignetteStockage";

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

  // ── RELAIS DU FICHIER DÉJÀ STOCKÉ (section 286) ─────────────────────────────────────────
  //
  // MESURÉ APRÈS LA BASCULE, et le résultat a démenti ma prévision : 187 invocations en 6 h
  // contre 246 en 12 h avant — le taux avait DOUBLÉ, pas baissé. Les journaux ont donné la
  // cause en une ligne :
  //
  //     User Agent     facebookexternalhit/1.1
  //     Search Params  f867dce05889de97        ← l'ANCIEN hachage d'URL
  //
  // Facebook ne scrape pas la page : il REVALIDE les URL d'images qu'il garde en cache,
  // publication par publication. Ces URL ne figurent plus nulle part dans le HTML, mais elles
  // vivent dans ses enregistrements — et le produit totalise 6 349 clics venus de ses groupes.
  //
  // J'avais prévu que ces appels tomberaient « à quelques unités ». Faux : j'avais supposé
  // qu'ils venaient de scrapes de PAGES, alors qu'ils viennent de revalidations d'IMAGES. La
  // route reste donc appelée au même rythme, indéfiniment.
  //
  // Elle n'a pourtant plus aucune raison de RECALCULER : la vignette existe déjà. On relaie le
  // fichier stocké, et le coût passe de ~1,47 s (Satori + sharp) à une lecture de base plus un
  // transfert — ~30 fois moins.
  //
  // POURQUOI RELAYER PLUTÔT QUE REDIRIGER. Une redirection 308 économiserait aussi les octets,
  // mais elle suppose que chaque robot la suive sur une image. Je ne peux pas le vérifier sans
  // forcer un re-scrape depuis un vrai compte Facebook, et c'est exactement le type de
  // supposition qui a rendu la prévision précédente fausse. Le relais ne suppose rien : la
  // réponse reste une image, octet pour octet celle d'avant. La bande passante, elle, ne change
  // pas — ces octets transitent déjà par Vercel aujourd'hui.
  const stockee = await prisma.mission
    .findFirst({
      where: { id, isActive: true, briqueStatus: BriqueStatus.RECHERCHE },
      select: { vignetteAt: true },
    })
    .catch(() => null);

  if (stockee?.vignetteAt) {
    const url = urlVignette(id, stockee.vignetteAt);
    if (url) {
      // Délai court et repli silencieux : si le stockage ne répond pas, on REND. Mieux vaut
      // payer le rendu que servir une image cassée sur la page la plus partagée du produit.
      const amont = await fetch(url, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (amont?.ok && amont.body) {
        return new Response(amont.body, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }
    }
  }

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
