import sharp from "sharp";
import { randomBytes } from "crypto";
import { Prisma, type StatutVitrine, type VitrineTerritoire } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createNotification } from "@/lib/notifications";
import { MENTION_LIEN_ADMIN } from "@/lib/besoinTerritoire";
import { structureLieeAdmin } from "@/lib/besoinTerritoireServeur";
import {
  LIMITES_VITRINE, erreurContenuVitrine, erreurPublicationVitrine, photosDe,
  type ContenuVitrine, type PhotoVitrine,
} from "@/lib/vitrineTerritoire";

// Vitrine du territoire — gestes serveur (02/11). Chaque geste modifie la vitrine ET écrit sa
// ligne `JournalVitrine` (ajout seul) dans la même transaction, comme les besoins. Les routes ne
// font qu'authentifier (éditeur nommé, administrateur) et appeler ces fonctions.

export type AuteurVitrine = { id: string | null; nom: string };
type Client = { id: string; nom: string };
type Resultat = { ok: true; vitrine: VitrineTerritoire } | { ok: false; status: number; error: string };

type ActionVitrine =
  | "CREATION" | "MODIFICATION" | "DEMANDE_PUBLICATION" | "PUBLICATION" | "MASQUAGE"
  | "VALIDATION" | "REFUS" | "RETRAIT" | "PHOTO_AJOUT" | "PHOTO_RETRAIT";

async function journaliser(
  tx: Prisma.TransactionClient, v: VitrineTerritoire, client: Client, action: ActionVitrine,
  statutAvant: StatutVitrine | null, auteur: AuteurVitrine, motif?: string | null,
) {
  await tx.journalVitrine.create({
    data: {
      clientId: client.id, clientNom: client.nom.slice(0, 200), action, statutAvant, statutApres: v.statut,
      auteurId: auteur.id, auteurNom: auteur.nom.slice(0, 160), motif: motif?.slice(0, LIMITES_VITRINE.motifMax) ?? null,
    },
  });
}

async function prevenirAdmins(message: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification({ userId: a.id, type: "besoin", message: message.slice(0, 300), linkUrl: "/admin/vitrines" })));
}

const nettoyer = (c: ContenuVitrine): ContenuVitrine => ({
  accroche: c.accroche.trim(),
  cadreDeVie: c.cadreDeVie?.trim() || null,
  offreSoins: c.offreSoins?.trim() || null,
  aidesInstallation: c.aidesInstallation?.trim() || null,
});

/**
 * Enregistre les textes (et les légendes des photos, dans leur ordre). Une vitrine publiée le
 * reste : ses modifications paraissent directement (la première publication a été relue), et
 * l'administration en est prévenue pour information. Une vitrine retirée redevient un brouillon.
 */
export async function enregistrerVitrine(client: Client, contenu: ContenuVitrine, legendes: string[] | null, auteur: AuteurVitrine): Promise<Resultat> {
  const c = nettoyer(contenu);
  const legs = (legendes ?? []).map((l) => l.trim());
  const err = erreurContenuVitrine(c, legs);
  if (err) return { ok: false, status: 400, error: err };
  const avant = await prisma.vitrineTerritoire.findUnique({ where: { clientId: client.id } });
  if (avant?.statut === "A_VALIDER") return { ok: false, status: 409, error: "Votre vitrine est en cours de relecture par Soignect : elle se modifie après la décision." };
  const photos = photosDe(avant?.photos).map((p, i) => (legendes && i < legs.length ? { ...p, legende: legs[i] } : p));
  const statut: StatutVitrine = avant?.statut === "PUBLIE" ? "PUBLIE" : "BROUILLON";
  const vitrine = await prisma.$transaction(async (tx) => {
    const v = avant
      ? await tx.vitrineTerritoire.update({ where: { id: avant.id }, data: { ...c, photos: photos as unknown as Prisma.InputJsonValue, statut } })
      : await tx.vitrineTerritoire.create({ data: { clientId: client.id, ...c } });
    await journaliser(tx, v, client, avant ? "MODIFICATION" : "CREATION", avant?.statut ?? null, auteur);
    return v;
  });
  if (statut === "PUBLIE") await prevenirAdmins(`Vitrine du territoire modifiée — ${client.nom}`);
  return { ok: true, vitrine };
}

/** Brouillon (ou vitrine retirée) → publiée si la structure a déjà été validée, sinon à valider. */
export async function demanderPublicationVitrine(client: Client, auteur: AuteurVitrine, maintenant = new Date()): Promise<Resultat> {
  const avant = await prisma.vitrineTerritoire.findUnique({ where: { clientId: client.id } });
  if (!avant) return { ok: false, status: 404, error: "Enregistrez d'abord votre vitrine." };
  if (avant.statut !== "BROUILLON" && avant.statut !== "RETIREE") return { ok: false, status: 409, error: "Cette vitrine n'est pas un brouillon." };
  const manque = erreurPublicationVitrine(avant);
  if (manque) return { ok: false, status: 400, error: manque };
  const directe = avant.valideLe !== null;
  const vitrine = await prisma.$transaction(async (tx) => {
    const v = await tx.vitrineTerritoire.update({
      where: { id: avant.id },
      data: directe ? { statut: "PUBLIE", publieLe: maintenant, motifRefus: null } : { statut: "A_VALIDER", motifRefus: null },
    });
    await journaliser(tx, v, client, directe ? "PUBLICATION" : "DEMANDE_PUBLICATION", avant.statut, auteur);
    return v;
  });
  await prevenirAdmins(directe ? `Vitrine du territoire publiée — ${client.nom}` : `Vitrine du territoire à valider — ${client.nom}`);
  return { ok: true, vitrine };
}

/** La structure retire elle-même sa vitrine de l'affichage ; elle la republie sans relecture. */
export async function masquerVitrine(client: Client, auteur: AuteurVitrine): Promise<Resultat> {
  const avant = await prisma.vitrineTerritoire.findUnique({ where: { clientId: client.id } });
  if (!avant) return { ok: false, status: 404, error: "Aucune vitrine." };
  if (avant.statut !== "PUBLIE") return { ok: false, status: 409, error: "Seule une vitrine publiée se masque." };
  const vitrine = await prisma.$transaction(async (tx) => {
    const v = await tx.vitrineTerritoire.update({ where: { id: avant.id }, data: { statut: "BROUILLON" } });
    await journaliser(tx, v, client, "MASQUAGE", "PUBLIE", auteur);
    return v;
  });
  return { ok: true, vitrine };
}

// ── Photos ──────────────────────────────────────────────────────────────────────────────────
// Bucket public `avatars` (déjà servi, comme le logo), sous `vitrines/<clientId>/<aléa>.jpg`.
// Chaque fichier est RÉÉCRIT au dépôt : JPEG de 1600 px au plus, orientation appliquée,
// métadonnées (EXIF, position GPS) retirées. Le type déclaré ne suffit pas : le contenu est relu.

export const PHOTO_FORMATS = ["image/jpeg", "image/png", "image/webp"] as const;
// Sous la limite de corps des fonctions Vercel (4,5 Mo) ; l'écran réduit la photo avant l'envoi.
export const PHOTO_MAX_OCTETS = 4 * 1024 * 1024;
const PHOTO_COTE_MAX = 1600;
const BUCKET = "avatars";

export class PhotoRefusee extends Error {}

export function erreurFichierPhoto(f: { size: number; type: string }): string | null {
  if (f.size > PHOTO_MAX_OCTETS) return "Photo trop lourde (4 Mo au plus).";
  if (!(PHOTO_FORMATS as readonly string[]).includes(f.type)) return "Format accepté : JPEG, PNG ou WebP.";
  return null;
}

export async function ajouterPhotoVitrine(client: Client, octets: Buffer, legende: string, auteur: AuteurVitrine): Promise<Resultat> {
  const avant = await prisma.vitrineTerritoire.findUnique({ where: { clientId: client.id } });
  if (!avant) return { ok: false, status: 409, error: "Enregistrez d'abord les textes de votre vitrine." };
  if (avant.statut === "A_VALIDER") return { ok: false, status: 409, error: "Votre vitrine est en cours de relecture par Soignect : elle se modifie après la décision." };
  const photos = photosDe(avant.photos);
  if (photos.length >= LIMITES_VITRINE.photosMax) return { ok: false, status: 409, error: `${LIMITES_VITRINE.photosMax} photos au plus : retirez-en une d'abord.` };
  const leg = legende.trim();
  const err = erreurContenuVitrine(avant, [leg]);
  if (err) return { ok: false, status: 400, error: err };

  const format = (await sharp(octets).metadata().catch(() => null))?.format;
  if (format !== "jpeg" && format !== "png" && format !== "webp") throw new PhotoRefusee("Ce fichier n'est pas une photo JPEG, PNG ou WebP.");
  const jpeg = await sharp(octets).rotate()
    .resize(PHOTO_COTE_MAX, PHOTO_COTE_MAX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const chemin = `vitrines/${client.id}/${randomBytes(8).toString("hex")}.jpg`;
  const sb = getSupabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(chemin, jpeg, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Stockage de la photo impossible : ${error.message}`);
  const url = sb.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;

  try {
    const suivantes: PhotoVitrine[] = [...photos, { url, chemin, legende: leg }];
    const vitrine = await prisma.$transaction(async (tx) => {
      const v = await tx.vitrineTerritoire.update({ where: { id: avant.id }, data: { photos: suivantes as unknown as Prisma.InputJsonValue } });
      await journaliser(tx, v, client, "PHOTO_AJOUT", avant.statut, auteur);
      return v;
    });
    if (avant.statut === "PUBLIE") await prevenirAdmins(`Vitrine du territoire : photo ajoutée — ${client.nom}`);
    return { ok: true, vitrine };
  } catch (e) {
    await sb.storage.from(BUCKET).remove([chemin]).catch(() => {});
    throw e;
  }
}

export async function retirerPhotoVitrine(client: Client, chemin: string, auteur: AuteurVitrine): Promise<Resultat> {
  const avant = await prisma.vitrineTerritoire.findUnique({ where: { clientId: client.id } });
  if (!avant) return { ok: false, status: 404, error: "Aucune vitrine." };
  if (avant.statut === "A_VALIDER") return { ok: false, status: 409, error: "Votre vitrine est en cours de relecture par Soignect : elle se modifie après la décision." };
  const photos = photosDe(avant.photos);
  if (!photos.some((p) => p.chemin === chemin)) return { ok: false, status: 404, error: "Photo introuvable." };
  const vitrine = await prisma.$transaction(async (tx) => {
    const v = await tx.vitrineTerritoire.update({
      where: { id: avant.id },
      data: { photos: photos.filter((p) => p.chemin !== chemin) as unknown as Prisma.InputJsonValue },
    });
    await journaliser(tx, v, client, "PHOTO_RETRAIT", avant.statut, auteur);
    return v;
  });
  await getSupabaseAdmin().storage.from(BUCKET).remove([chemin]).catch((e) => console.error("[vitrine] retrait du fichier:", e));
  return { ok: true, vitrine };
}

// ── Administration ──────────────────────────────────────────────────────────────────────────

/** Valider ou refuser une première publication ; retirer une vitrine publiée. Refus et retrait
 *  se motivent. Un retrait remet `valideLe` à null : la publication suivante sera relue. */
export async function deciderVitrine(id: string, decision: "valider" | "refuser" | "retirer", auteur: AuteurVitrine, motif: string | null, maintenant = new Date()): Promise<Resultat> {
  const avant = await prisma.vitrineTerritoire.findUnique({ where: { id }, include: { client: { select: { id: true, nom: true } } } });
  if (!avant) return { ok: false, status: 404, error: "Vitrine introuvable." };
  const attendu: StatutVitrine = decision === "retirer" ? "PUBLIE" : "A_VALIDER";
  if (avant.statut !== attendu) {
    return { ok: false, status: 409, error: decision === "retirer" ? "Seule une vitrine publiée se retire." : "Cette vitrine n'attend pas de validation." };
  }
  const m = (motif ?? "").trim();
  if (decision !== "valider" && !m) return { ok: false, status: 400, error: decision === "retirer" ? "Un retrait se motive." : "Un refus se motive." };
  const lie = await structureLieeAdmin(avant.clientId);
  const motifJournal = [lie ? MENTION_LIEN_ADMIN : null, m || null].filter(Boolean).join(" — ") || null;
  const data: Prisma.VitrineTerritoireUpdateInput =
    decision === "valider" ? { statut: "PUBLIE", valideLe: maintenant, publieLe: maintenant, motifRefus: null }
    : decision === "refuser" ? { statut: "BROUILLON", motifRefus: m.slice(0, LIMITES_VITRINE.motifMax) }
    : { statut: "RETIREE", valideLe: null, motifRefus: m.slice(0, LIMITES_VITRINE.motifMax) };
  const vitrine = await prisma.$transaction(async (tx) => {
    const v = await tx.vitrineTerritoire.update({ where: { id }, data });
    await journaliser(tx, v, avant.client, decision === "valider" ? "VALIDATION" : decision === "refuser" ? "REFUS" : "RETRAIT", avant.statut, auteur, motifJournal);
    return v;
  });
  // Les éditeurs de la structure sont prévenus de la décision.
  const editeurs = await prisma.editeurClient.findMany({ where: { clientId: avant.clientId, retireLe: null }, select: { userId: true } });
  const page = await prisma.pageClient.findUnique({ where: { clientId: avant.clientId }, select: { jetonEdition: true } });
  const message = decision === "valider" ? "Votre vitrine du territoire est publiée."
    : decision === "refuser" ? `Votre vitrine du territoire vous est renvoyée : ${m}`
    : `Votre vitrine du territoire a été retirée par Soignect : ${m}`;
  await Promise.all(editeurs.map((e) => createNotification({ userId: e.userId, type: "besoin", message, linkUrl: page ? `/gestion/${page.jetonEdition}#bloc-vitrine` : "/structure" })));
  return { ok: true, vitrine };
}
