import { Prisma, type ActionBesoin, type BesoinTerritoire, type NatureBesoin, type Profession, type StatutBesoin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  BESOINS_ACTIFS_MAX, LIMITES_BESOIN, echeanceDepuis, erreurTexteBesoin, specialiteNormalisee,
} from "@/lib/besoinTerritoire";

// Besoin du territoire — gestes serveur (23/10). Chaque geste modifie le besoin ET écrit sa ligne
// `JournalBesoin` (ajout seul) dans la même transaction : un changement sans trace est impossible.
// Les routes ne font qu'authentifier (éditeur nommé, administrateur) et appeler ces fonctions.

export type AuteurBesoin = { id: string | null; nom: string };
type Client = { id: string; nom: string };
type Resultat<T> = { ok: true; besoin: T } | { ok: false; status: number; error: string };

const ACTIFS: StatutBesoin[] = ["A_VALIDER", "PUBLIE"];

async function journaliser(
  tx: Prisma.TransactionClient, b: BesoinTerritoire, client: Client, action: ActionBesoin,
  statutAvant: StatutBesoin | null, auteur: AuteurBesoin, motif?: string | null,
) {
  await tx.journalBesoin.create({
    data: {
      besoinId: b.id, clientId: client.id, clientNom: client.nom.slice(0, 200), codeInsee: b.codeInsee, commune: b.commune,
      profession: b.profession, action, statutAvant, statutApres: b.statut, auteurId: auteur.id,
      auteurNom: auteur.nom.slice(0, 160), motif: motif?.slice(0, LIMITES_BESOIN.motifMax) ?? null,
    },
  });
}

/** Archive les besoins publiés dont l'échéance est passée — avant tout contrôle d'unicité. */
export async function archiverBesoinsEchus(maintenant = new Date()): Promise<number> {
  const echus = await prisma.besoinTerritoire.findMany({
    where: { statut: "PUBLIE", expireLe: { lte: maintenant } },
    include: { client: { select: { id: true, nom: true } } },
  });
  for (const b of echus) {
    await prisma.$transaction(async (tx) => {
      const maj = await tx.besoinTerritoire.update({ where: { id: b.id }, data: { statut: "ARCHIVE" } });
      await journaliser(tx, maj, b.client, "ARCHIVAGE", "PUBLIE", { id: null, nom: "Soignect (échéance)" }, "Échéance de publication passée");
    });
  }
  return echus.length;
}

export interface ChampsBesoin {
  codeInsee: string; commune: string; profession: Profession; specialite?: string | null;
  nature: NatureBesoin; texte: string; proposition?: string | null;
}

function erreurChamps(c: ChampsBesoin): string | null {
  const t = c.texte.trim();
  if (t.length < LIMITES_BESOIN.texteMin || t.length > LIMITES_BESOIN.texteMax) {
    return `Le texte fait de ${LIMITES_BESOIN.texteMin} à ${LIMITES_BESOIN.texteMax} caractères.`;
  }
  if ((c.proposition ?? "").length > LIMITES_BESOIN.propositionMax) return `Ce que vous proposez : ${LIMITES_BESOIN.propositionMax} caractères au plus.`;
  if ((c.specialite ?? "").length > LIMITES_BESOIN.specialiteMax) return `Spécialité : ${LIMITES_BESOIN.specialiteMax} caractères au plus.`;
  return erreurTexteBesoin("Le texte", t) ?? erreurTexteBesoin("Ce que vous proposez", c.proposition);
}

/** Crée un BROUILLON. La commune doit appartenir au périmètre de la page (contrôlé par l'appelant). */
export async function creerBesoin(client: Client, c: ChampsBesoin, auteur: AuteurBesoin): Promise<Resultat<BesoinTerritoire>> {
  const err = erreurChamps(c);
  if (err) return { ok: false, status: 400, error: err };
  const besoin = await prisma.$transaction(async (tx) => {
    const b = await tx.besoinTerritoire.create({
      data: {
        clientId: client.id, codeInsee: c.codeInsee, commune: c.commune, profession: c.profession,
        specialite: specialiteNormalisee(c.specialite), nature: c.nature, texte: c.texte.trim(),
        proposition: c.proposition?.trim() || null, creeParId: auteur.id ?? "",
      },
    });
    await journaliser(tx, b, client, "CREATION", null, auteur);
    return b;
  });
  return { ok: true, besoin };
}

/** Seul un BROUILLON se modifie : un besoin publié ne change pas de contenu sans repasser par là. */
export async function modifierBesoin(client: Client, id: string, c: ChampsBesoin, auteur: AuteurBesoin): Promise<Resultat<BesoinTerritoire>> {
  const avant = await prisma.besoinTerritoire.findFirst({ where: { id, clientId: client.id } });
  if (!avant) return { ok: false, status: 404, error: "Besoin introuvable." };
  if (avant.statut !== "BROUILLON") return { ok: false, status: 409, error: "Seul un brouillon se modifie. Archivez ce besoin pour en préparer un autre." };
  const err = erreurChamps(c);
  if (err) return { ok: false, status: 400, error: err };
  const besoin = await prisma.$transaction(async (tx) => {
    const b = await tx.besoinTerritoire.update({
      where: { id },
      data: {
        codeInsee: c.codeInsee, commune: c.commune, profession: c.profession, specialite: specialiteNormalisee(c.specialite),
        nature: c.nature, texte: c.texte.trim(), proposition: c.proposition?.trim() || null, motifRefus: null,
      },
    });
    await journaliser(tx, b, client, "MODIFICATION", "BROUILLON", auteur);
    return b;
  });
  return { ok: true, besoin };
}

/** Case déjà prise par un besoin actif (premier arrivé) ? Rend le nom de la structure qui la tient. */
async function caseOccupee(b: Pick<BesoinTerritoire, "id" | "codeInsee" | "profession" | "specialite">): Promise<string | null> {
  const autres = await prisma.besoinTerritoire.findMany({
    where: { id: { not: b.id }, codeInsee: b.codeInsee, profession: b.profession, statut: { in: ACTIFS } },
    select: { specialite: true, client: { select: { nom: true } } },
  });
  const s = (b.specialite ?? "").toLowerCase();
  return autres.find((a) => (a.specialite ?? "").toLowerCase() === s)?.client.nom ?? null;
}

/**
 * Demande de publication d'un brouillon. Première publication de la structure (aucun besoin déjà
 * validé) → A_VALIDER, et l'administration est prévenue ; sinon → PUBLIE directement.
 */
export async function demanderPublication(client: Client, id: string, auteur: AuteurBesoin, maintenant = new Date()): Promise<Resultat<BesoinTerritoire>> {
  await archiverBesoinsEchus(maintenant);
  const avant = await prisma.besoinTerritoire.findFirst({ where: { id, clientId: client.id } });
  if (!avant) return { ok: false, status: 404, error: "Besoin introuvable." };
  if (avant.statut !== "BROUILLON") return { ok: false, status: 409, error: "Ce besoin n'est pas un brouillon." };
  const actifs = await prisma.besoinTerritoire.count({ where: { clientId: client.id, statut: { in: ACTIFS } } });
  if (actifs >= BESOINS_ACTIFS_MAX) return { ok: false, status: 409, error: `${BESOINS_ACTIFS_MAX} besoins actifs au plus : archivez-en un avant d'en publier un autre.` };
  const tenu = await caseOccupee(avant);
  if (tenu) {
    return { ok: false, status: 409, error: `Un besoin est déjà publié pour cette commune et cette profession, par ${tenu} (premier arrivé). À arbitrer entre les deux structures.` };
  }
  const dejaValidee = (await prisma.besoinTerritoire.count({ where: { clientId: client.id, valideLe: { not: null } } })) > 0;
  try {
    const besoin = await prisma.$transaction(async (tx) => {
      const b = await tx.besoinTerritoire.update({
        where: { id },
        data: dejaValidee
          ? { statut: "PUBLIE", publieLe: maintenant, expireLe: echeanceDepuis(maintenant), motifRefus: null }
          : { statut: "A_VALIDER", motifRefus: null },
      });
      await journaliser(tx, b, client, dejaValidee ? "PUBLICATION" : "DEMANDE_PUBLICATION", "BROUILLON", auteur);
      return b;
    });
    if (!dejaValidee) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await Promise.all(admins.map((a) => createNotification({
        userId: a.id, type: "besoin",
        message: `Besoin du territoire à valider — ${client.nom} : ${besoin.commune}`.slice(0, 300),
        linkUrl: "/admin/besoins",
      })));
    }
    return { ok: true, besoin };
  } catch (e) {
    // L'index unique partiel tranche une course entre deux structures sur la même case.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, status: 409, error: "Un besoin vient d'être publié pour cette case par une autre structure." };
    }
    throw e;
  }
}

/** Décision de l'administration sur un besoin A_VALIDER. */
export async function deciderBesoin(id: string, decision: "valider" | "refuser", auteur: AuteurBesoin, motif: string | null, maintenant = new Date()): Promise<Resultat<BesoinTerritoire>> {
  const avant = await prisma.besoinTerritoire.findUnique({ where: { id }, include: { client: { select: { id: true, nom: true } } } });
  if (!avant) return { ok: false, status: 404, error: "Besoin introuvable." };
  if (avant.statut !== "A_VALIDER") return { ok: false, status: 409, error: "Ce besoin n'attend pas de validation." };
  if (decision === "refuser" && !(motif ?? "").trim()) return { ok: false, status: 400, error: "Un refus se motive." };
  const besoin = await prisma.$transaction(async (tx) => {
    const b = await tx.besoinTerritoire.update({
      where: { id },
      data: decision === "valider"
        ? { statut: "PUBLIE", valideLe: maintenant, publieLe: maintenant, expireLe: echeanceDepuis(maintenant) }
        : { statut: "BROUILLON", motifRefus: motif!.trim().slice(0, LIMITES_BESOIN.motifMax) },
    });
    await journaliser(tx, b, avant.client, decision === "valider" ? "VALIDATION" : "REFUS", "A_VALIDER", auteur, motif);
    return b;
  });
  return { ok: true, besoin };
}

/** Prolonge un besoin publié d'une durée de publication, à compter d'aujourd'hui. */
export async function renouvelerBesoin(client: Client, id: string, auteur: AuteurBesoin, maintenant = new Date()): Promise<Resultat<BesoinTerritoire>> {
  const avant = await prisma.besoinTerritoire.findFirst({ where: { id, clientId: client.id } });
  if (!avant) return { ok: false, status: 404, error: "Besoin introuvable." };
  if (avant.statut !== "PUBLIE") return { ok: false, status: 409, error: "Seul un besoin publié se renouvelle." };
  const besoin = await prisma.$transaction(async (tx) => {
    const b = await tx.besoinTerritoire.update({ where: { id }, data: { expireLe: echeanceDepuis(maintenant) } });
    await journaliser(tx, b, client, "RENOUVELLEMENT", "PUBLIE", auteur);
    return b;
  });
  return { ok: true, besoin };
}

export async function archiverBesoin(client: Client, id: string, auteur: AuteurBesoin): Promise<Resultat<BesoinTerritoire>> {
  const avant = await prisma.besoinTerritoire.findFirst({ where: { id, clientId: client.id } });
  if (!avant) return { ok: false, status: 404, error: "Besoin introuvable." };
  if (avant.statut === "ARCHIVE") return { ok: false, status: 409, error: "Ce besoin est déjà archivé." };
  const besoin = await prisma.$transaction(async (tx) => {
    const b = await tx.besoinTerritoire.update({ where: { id }, data: { statut: "ARCHIVE" } });
    await journaliser(tx, b, client, "ARCHIVAGE", avant.statut, auteur);
    return b;
  });
  return { ok: true, besoin };
}
