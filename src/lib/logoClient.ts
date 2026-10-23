import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Logo d'une structure (23/10) — source unique des formats, du traitement et du stockage.
//
// Stocké dans le bucket public `avatars` (déjà servi, déjà utilisé pour les photos), sous
// `structures/<clientId>.png` : pas de nouveau bucket à créer à la main. Le fichier est
// RÉÉCRIT en PNG de 512 px au plus, une fois, au dépôt : un logo transparent le reste, un fichier lourd ou exotique
// ne sort jamais tel quel, et les métadonnées (EXIF…) sont retirées au passage.

// Décisions de JC (23/10) : PNG ou JPEG, 1 Mo au plus, SVG refusé. Le type déclaré ne suffit
// pas : le contenu est relu (`formatReel`) et seul un vrai PNG ou JPEG passe.
export const LOGO_FORMATS = ["image/png", "image/jpeg"] as const;
export const LOGO_MAX_OCTETS = 1024 * 1024;
export const LOGO_COTE_MAX = 512;
const BUCKET = "avatars";
const chemin = (clientId: string) => `structures/${clientId}.png`;

export function erreurFichierLogo(f: { size: number; type: string }): string | null {
  if (f.size > LOGO_MAX_OCTETS) return "Logo trop lourd (1 Mo au plus).";
  if (!(LOGO_FORMATS as readonly string[]).includes(f.type)) return "Format accepté : PNG ou JPEG (SVG refusé).";
  return null;
}

export class LogoRefuse extends Error {}

/** Réécrit et stocke le logo ; rend son URL publique (avec un repère de version). La réécriture
 *  se fait ici, dans la fonction, une fois au dépôt : aucune optimisation d'image Vercel (le logo
 *  est servi tel quel depuis le stockage, par une balise <img>). */
export async function stockerLogo(clientId: string, octets: Buffer): Promise<string> {
  const formatReel = (await sharp(octets).metadata().catch(() => null))?.format;
  if (formatReel !== "png" && formatReel !== "jpeg") throw new LogoRefuse("Ce fichier n'est pas un PNG ou un JPEG (SVG refusé).");
  const png = await sharp(octets)
    .resize(LOGO_COTE_MAX, LOGO_COTE_MAX, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const sb = getSupabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(chemin(clientId), png, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Stockage du logo impossible : ${error.message}`);
  const { data } = sb.storage.from(BUCKET).getPublicUrl(chemin(clientId));
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function effacerLogo(clientId: string): Promise<void> {
  await getSupabaseAdmin().storage.from(BUCKET).remove([chemin(clientId)]);
}
