import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Signature manuscrite conservée d'un contrat à l'autre (section 242).
//
// LE BUCKET RESTE PRIVÉ. `signatures` n'est jamais lu par le navigateur : la route du contrat en
// télécharge le fichier côté serveur et l'inline en base64 dans le PDF. Une signature conservée
// suit exactement le même chemin. Elle n'est PAS rangée dans `avatars`, qui est public et sert le
// feed — l'y mettre aurait rendu la signature de chacun téléchargeable par son URL.
//
// ── LA DÉCISION QUI COMPTE : ON COPIE, ON NE RÉFÉRENCE PAS ────────────────────────────────────
//
// Un contrat signé pointe vers SON PROPRE fichier, `{matchId}/{côté}.ext`, jamais vers celui du
// profil. Réutiliser signifie donc DUPLIQUER le fichier conservé à l'emplacement du match, pas y
// faire un lien.
//
// La différence n'est pas théorique. Si le match pointait vers le fichier de profil, refaire sa
// signature en 2027 changerait rétroactivement l'image apposée sur un contrat signé en 2026 —
// silencieusement, sur un document déjà engagé, et sans que le PDF déjà téléchargé et celui
// régénéré ne se ressemblent. Un contrat signé est figé : ce qui a été apposé reste apposé.
//
// Coût de la copie : un aller-retour de quelques dizaines de kilo-octets, une fois par signature.

/** Extensions acceptées, alignées sur ce que la route de signature autorise déjà. */
const EXTENSIONS = ["png", "webp", "jpg"] as const;

export const BUCKET_SIGNATURES = "signatures";

/** Emplacement de la signature conservée d'un profil. Préfixe `profil/` pour qu'elle ne puisse
 *  jamais entrer en collision avec un identifiant de match. */
export function cheminSignatureProfil(profileId: string, ext: string): string {
  return `profil/${profileId}.${ext}`;
}

/** Extension d'un chemin stocké, pour retrouver le type de contenu à la relecture. */
export function extensionDe(chemin: string): string {
  return chemin.split(".").pop() ?? "jpg";
}

export function contentTypeDe(ext: string): string {
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

/**
 * Duplique la signature conservée à l'emplacement d'un match.
 *
 * Renvoie le chemin écrit, ou `null` si la copie a échoué — l'appelant doit alors refuser plutôt
 * que d'enregistrer une signature qui n'existe pas. Une ligne `Match.signature*Url` pointant vers
 * un fichier absent ferait un contrat « signé » dont le PDF n'afficherait rien.
 */
export async function copierSignatureVersMatch(
  cheminSource: string,
  matchId: string,
  cote: "titulaire" | "remplacant",
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const ext = extensionDe(cheminSource);
  const cible = `${matchId}/${cote}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET_SIGNATURES).download(cheminSource);
  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(BUCKET_SIGNATURES)
    .upload(cible, buffer, { contentType: contentTypeDe(ext), upsert: true });
  if (upErr) return null;

  return cible;
}

/**
 * Efface la signature conservée d'un profil, quelle que soit son extension.
 *
 * NE JETTE JAMAIS. Appelée au retrait du consentement et à la suppression de compte : dans les
 * deux cas l'effacement en base fait foi, et un stockage momentanément indisponible ne doit pas
 * empêcher quelqu'un de retirer son consentement ou de supprimer son compte.
 */
export async function effacerSignatureProfil(profileId: string): Promise<void> {
  try {
    await getSupabaseAdmin()
      .storage.from(BUCKET_SIGNATURES)
      .remove(EXTENSIONS.map((e) => cheminSignatureProfil(profileId, e)));
  } catch {
    /* le stockage est secondaire : la colonne remise à null est ce qui fait autorité */
  }
}

/** Bucket PUBLIC des photos de profil. Public parce que le feed les affiche — raison pour
 *  laquelle une signature n'y a jamais été rangée (section 242). */
export const BUCKET_AVATARS = "avatars";

/**
 * Efface les fichiers d'un compte supprimé : photos de profil ET signatures apposées sur ses
 * contrats (section 244).
 *
 * ── POURQUOI CE N'ÉTAIT PAS FAIT ─────────────────────────────────────────────────────────────
 *
 * La suppression de compte ne touchait AUCUN fichier. Elle effaçait les lignes — notes, messages,
 * matchs, missions, traces — puis le compte, et laissait derrière elle la photo de la personne
 * dans un bucket public et l'image de sa signature manuscrite dans le bucket privé.
 *
 * Les deux survivaient indéfiniment. La photo restait accessible par son URL publique à qui
 * l'avait vue une fois, longtemps après l'effacement du compte. C'est très exactement ce qu'un
 * droit à l'effacement interdit, et c'est le même raisonnement que celui déjà écrit ici pour les
 * `TraceEvent` : « elles survivraient en silence en gardant l'identifiant d'une personne
 * effacée ».
 *
 * Signalé en corrigeant la signature conservée, qui posait la question pour les trois à la fois.
 *
 * NE JETTE JAMAIS. Un stockage indisponible ne doit pas empêcher quelqu'un de supprimer son
 * compte : les lignes effacées font autorité, un fichier orphelin sans chemin qui y mène n'est
 * plus atteignable par le produit.
 */
export async function effacerFichiersDuCompte(opts: {
  profileId: string | null;
  /** Chemins relevés sur les matchs AVANT leur suppression — après, ils sont perdus. */
  cheminsSignaturesMatchs: string[];
}): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (opts.profileId) {
    // Photos : le nom de fichier est déterministe (`{id}.jpg`, `-s1`, `-s2`) et toujours en .jpg,
    // quelle que soit l'image envoyée — la route d'upload fige l'extension. On peut donc les
    // supprimer sans lire les colonnes, qui portent une URL publique et non un chemin.
    try {
      await supabase.storage
        .from(BUCKET_AVATARS)
        .remove([`${opts.profileId}.jpg`, `${opts.profileId}-s1.jpg`, `${opts.profileId}-s2.jpg`]);
    } catch { /* voir plus haut : le stockage ne bloque pas une suppression de compte */ }

    await effacerSignatureProfil(opts.profileId);
  }

  // Signatures apposées sur les contrats. Celle de l'AUTRE partie part aussi : le match auquel
  // elle appartient disparaît, et une signature manuscrite sans le contrat qu'elle signait n'est
  // plus une pièce, seulement une image d'écriture personnelle conservée sans motif.
  if (opts.cheminsSignaturesMatchs.length > 0) {
    try {
      await supabase.storage.from(BUCKET_SIGNATURES).remove(opts.cheminsSignaturesMatchs);
    } catch { /* idem */ }
  }
}
