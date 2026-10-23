import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Logo d'une structure (23/10) — source unique des formats, du traitement et du stockage.
//
// Stocké dans le bucket public `avatars` (déjà servi, déjà utilisé pour les photos), sous
// `structures/<clientId>.png` : pas de nouveau bucket à créer à la main. Le fichier est
// RÉÉCRIT en PNG de 512 px au plus : un logo transparent le reste, un fichier lourd ou exotique
// ne sort jamais tel quel, et les métadonnées (EXIF…) sont retirées au passage.

export const LOGO_FORMATS = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_OCTETS = 2 * 1024 * 1024;
export const LOGO_COTE_MAX = 512;
const BUCKET = "avatars";
const chemin = (clientId: string) => `structures/${clientId}.png`;

export function erreurFichierLogo(f: { size: number; type: string }): string | null {
  if (f.size > LOGO_MAX_OCTETS) return "Logo trop lourd (2 Mo au plus).";
  if (!(LOGO_FORMATS as readonly string[]).includes(f.type)) return "Format accepté : PNG, JPEG ou WebP.";
  return null;
}

/** Réécrit et stocke le logo ; rend son URL publique (avec un repère de version). */
export async function stockerLogo(clientId: string, octets: Buffer): Promise<string> {
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
