import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { rendreVignetteJpeg, ErreurRenduVignette } from "@/lib/vignetteAnnonce";

// ── LA VIGNETTE SE CALCULE UNE FOIS, À LA PUBLICATION (section 285) ──────────────────────────
//
// Mesuré le 07/10 sur la production : `/annonce/[id]/opengraph-image` consommait **6 minutes de
// CPU sur 12 heures**, ~80 % du total du produit, pour 246 invocations. Le compte Vercel
// affichait 222 % du quota gratuit — et c'est ce dépassement, pas un build en échec, qui finit
// par suspendre un projet Hobby.
//
// La cause n'était pas le coût unitaire (1,47 s) mais la FRÉQUENCE : **251 requêtes CDN pour
// 246 invocations**, soit un cache qui ne sert quasiment jamais. Les robots de Facebook et de
// WhatsApp scrapent depuis des points de présence distincts, chacun avec son propre cache.
// Allonger l'en-tête n'y change rien : le travail est refait à chaque PoP.
//
// Or une vignette ne dépend QUE de l'annonce. La régénérer à chaque scrape, c'est refaire un
// calcul dont le résultat était déjà connu.
//
// ── CE QUE LA MESURE DONNE ───────────────────────────────────────────────────────────────────
//
//   régime actuel    ~15 000 générations / mois     ≈ 6 h 10 de CPU
//   régime proposé        55 générations / mois     ≈ 81 s
//                    (créations + modifications réelles d'annonces sur 30 jours)
//   rattrapage            61 vignettes, une fois    ≈ 90 s
//
// ── POURQUOI LA ROUTE DYNAMIQUE SURVIT ───────────────────────────────────────────────────────
//
// Deux raisons, et aucune n'est cosmétique. Les aperçus DÉJÀ scrapés par Facebook pointent sur
// son URL : la supprimer casserait tout ce qui circule déjà, sur la page la plus partagée du
// produit. Et une annonce dont la génération échoue doit rester partageable — `vignetteAt` reste
// `null`, la métadonnée ne bascule pas, et le repli sert l'image comme avant.
//
// C'est ce qui rend la bascule PROGRESSIVE : chaque annonce passe au stockage quand sa vignette
// existe, aucune n'attend les autres, et un échec ne dégrade rien.

/** Bucket public dédié. Séparé d'`avatars` : ce ne sont pas des données d'utilisateur mais un
 *  dérivé calculé, qu'on doit pouvoir purger et régénérer en entier sans toucher aux photos. */
export const BUCKET_VIGNETTES = "vignettes";

/** Chemin déterministe — une annonce, un fichier. La version ne vit PAS dans le nom : elle
 *  voyage en paramètre d'URL (voir `urlVignette`), ce qui évite d'accumuler un fichier par
 *  modification et de devoir nettoyer derrière. */
export function cheminVignette(missionId: string): string {
  return `annonce/${missionId}.jpg`;
}

/**
 * URL publique de la vignette stockée, versionnée.
 *
 * Le `?v=` porte l'horodatage de génération. Sans lui, une annonce modifiée garderait son
 * ancienne image dans les caches sociaux — qui retiennent longtemps. Avec lui, l'URL change à
 * chaque régénération et le cache précédent devient inatteignable plutôt que périmé.
 */
export function urlVignette(missionId: string, vignetteAt: Date): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET_VIGNETTES}/${cheminVignette(missionId)}?v=${vignetteAt.getTime()}`;
}

export type ResultatVignette =
  | { etat: "generee"; octets: number }
  | { etat: "sans_objet" }      // annonce absente ou plus proposable
  | { etat: "echec"; motif: string };

/**
 * Rend la vignette d'une annonce, la stocke, et date la génération.
 *
 * NE LÈVE JAMAIS. Les appelants sont des routes de publication : un échec de vignette ne doit
 * pas faire échouer la publication d'une annonce. Le produit retombe alors sur la route
 * dynamique, c'est-à-dire sur le comportement d'avant cette section — jamais sur rien.
 */
export async function genererEtStockerVignette(missionId: string): Promise<ResultatVignette> {
  let jpeg: Buffer | null;
  try {
    jpeg = await rendreVignetteJpeg(missionId);
  } catch (e) {
    const motif = e instanceof ErreurRenduVignette ? "base indisponible" : String(e);
    console.error(`[vignette] rendu échoué pour ${missionId}:`, e);
    return { etat: "echec", motif };
  }

  // Annonce retirée ou jamais proposable : on ne stocke rien, et on EFFACE une éventuelle
  // vignette précédente. Laisser traîner l'image d'une annonce dépubliée la rendrait encore
  // partageable depuis un lien ancien.
  if (!jpeg) {
    await effacerVignette(missionId);
    return { etat: "sans_objet" };
  }

  try {
    const { error } = await getSupabaseAdmin()
      .storage.from(BUCKET_VIGNETTES)
      .upload(cheminVignette(missionId), jpeg, {
        contentType: "image/jpeg",
        // `upsert` parce que le chemin est déterministe : une modification écrase, et c'est le
        // `?v=` de l'URL qui empêche les caches de servir l'ancienne.
        upsert: true,
        // Un an : le contenu d'une URL versionnée ne change jamais. C'est toute la différence
        // avec la route dynamique, dont l'URL était stable et le contenu variable.
        cacheControl: "31536000",
      });
    if (error) {
      console.error(`[vignette] téléversement échoué pour ${missionId}:`, error.message);
      return { etat: "echec", motif: error.message };
    }
  } catch (e) {
    console.error(`[vignette] téléversement échoué pour ${missionId}:`, e);
    return { etat: "echec", motif: String(e) };
  }

  // La date est posée EN DERNIER, et c'est elle qui fait basculer la métadonnée. Tant qu'elle
  // est nulle, `generateMetadata` sert le repli : un téléversement à moitié fait ne peut donc
  // pas produire un og:image qui pointe vers un fichier absent.
  await prisma.mission.update({ where: { id: missionId }, data: { vignetteAt: new Date() } })
    .catch((e) => console.error(`[vignette] datation échouée pour ${missionId}:`, e));

  return { etat: "generee", octets: jpeg.length };
}

/**
 * Retire la vignette stockée et sa date — la métadonnée repasse au repli dynamique.
 *
 * ⚠️ CE QUE CETTE FONCTION NE FAIT PAS, vérifié à l'écran : l'objet est bien supprimé du bucket,
 * mais le CDN de Supabase continue de servir sa copie jusqu'à expiration (un an, voir
 * `cacheControl` ci-dessus). Une URL de vignette reste donc atteignable après la suppression de
 * l'annonce.
 *
 * Conservé ainsi, et c'est un arbitrage : l'URL est VERSIONNÉE, donc immuable par construction —
 * un an est la durée juste pour un contenu qui ne change jamais, et la raccourcir ferait payer à
 * toutes les annonces vivantes le cas rare de la suppression. L'impact réel est faible : la page
 * `/annonce/[id]` renvoie 404, donc aucun aperçu NEUF ne peut être construit ; seul l'accès
 * direct au fichier survit, et Facebook héberge de toute façon sa propre copie des aperçus déjà
 * scrapés.
 */
export async function effacerVignette(missionId: string): Promise<void> {
  try {
    await getSupabaseAdmin().storage.from(BUCKET_VIGNETTES).remove([cheminVignette(missionId)]);
  } catch (e) {
    console.error(`[vignette] effacement échoué pour ${missionId}:`, e);
  }
  await prisma.mission.update({ where: { id: missionId }, data: { vignetteAt: null } })
    .catch(() => { /* l'annonce peut avoir été supprimée : rien à dater */ });
}
