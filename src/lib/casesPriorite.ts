// Cases prioritaires : unicité, chevauchement, plafond par palier (point 7, 21/10), réglages fins
// et journal en ajout seul (point 8, 22/10).
//
// Une CASE est une ligne `PrioriteTerritoriale` : une commune × une profession. Tous les chemins
// qui en créent, en modifient ou en retirent une — /gestion, /admin/priorites, recalcul APL et
// passage en démonstration dans /admin/pages — passent par ce module : une seule règle, écrite
// une fois, et chaque geste laisse une ligne `JournalReglage` dans la même transaction.
//
// RÈGLE DE CHEVAUCHEMENT (MSP, établissement, CPTS sur une même commune) — PREMIER ARRIVÉ :
//   1. Une case n'a qu'un titulaire (contrainte `@@unique([codeInsee, profession])`). Pas de
//      double étiquette, pas de cumul des boosts.
//   2. Tant que la déclaration du titulaire est VIVANTE (non échue, relation client active), la
//      case lui reste — même si la structure qui arrive ensuite est plus locale (une MSP dans le
//      territoire d'une CPTS) ou paie plus. Elle est refusée, avec le nom du titulaire.
//   3. Quand cette déclaration s'éteint (échéance, revue dépassée, clôture), la case se libère :
//      la structure suivante peut la reprendre. La ligne éteinte est retirée (journalisé, au nom
//      de son ancien titulaire), la nouvelle en garde la trace dans sa note.
//   4. Le produit ne tranche jamais entre deux structures vivantes : c'est à elles de s'entendre,
//      et à l'administrateur de retirer la case à la demande de son titulaire.
//
// PLAFOND : MSP 8 cases, établissement 16, CPTS sans plafond (soumise à la densité du fil) —
// grille `TARIFS_PARTENAIRE` (lib/tarifsPartenaire), source unique.
//
// RÉGLAGE FIN : ±1 autour du niveau APL sans justification, au-delà justification écrite —
// `erreurReglage` (lib/boostTerritorial), source unique des seuils.

import { prisma } from "@/lib/prisma";
import type {
  ActionReglage, NatureRelationInstitutionnelle, OriginePriorite, Prisma, PrioriteTerritoriale,
  Profession, TypeInstitution,
} from "@prisma/client";
import { limitesDuType } from "@/lib/tarifsPartenaire";
import { paliersApl } from "@/lib/aplPalier";

type Db = Prisma.TransactionClient;
export type ClientCase = { id: string; nom: string; type: TypeInstitution; nature: NatureRelationInstitutionnelle };
export type Auteur = { id: string | null; nom: string };
export const AUTEUR_RECALCUL = (adminId: string): Auteur => ({ id: adminId, nom: "Recalcul APL" });

export type ControleCase =
  | { ok: true; reprise: { ligne: PrioriteTerritoriale; client: ClientCase } | null }
  | { ok: false; conflit: "meme-institution" | "chevauchement" | "plafond"; error: string };

function vivante(
  l: { expireLe: Date | null; client: { clotureLe: Date | null; debutLe: Date; revueLe: Date } },
  maintenant: Date,
): boolean {
  return (l.expireLe === null || l.expireLe > maintenant)
    && l.client.clotureLe === null && l.client.debutLe <= maintenant && l.client.revueLe > maintenant;
}

/** Niveau APL d'une case — null si la profession ou la commune n'a pas d'APL. */
export async function niveauAplDe(codeInsee: string, profession: Profession): Promise<number | null> {
  return (await paliersApl([codeInsee])).find((p) => p.profession === profession)?.niveau ?? null;
}

/** Cases tenues par un client : ses lignes non échues. */
export async function casesTenues(clientId: string, maintenant: Date = new Date()): Promise<number> {
  return prisma.prioriteTerritoriale.count({
    where: { clientId, OR: [{ expireLe: null }, { expireLe: { gt: maintenant } }] },
  });
}

/** Écrit une ligne de journal. Toujours dans la transaction du geste qu'elle décrit. */
export async function journaliser(
  db: Db,
  e: {
    client: ClientCase; ligne: { codeInsee: string; commune: string; profession: Profession; origine: OriginePriorite; niveauApl: number | null };
    action: ActionReglage; avant: number | null; apres: number | null;
    justification?: string | null; auteur: Auteur; motif?: string | null;
  },
): Promise<void> {
  await db.journalReglage.create({
    data: {
      clientId: e.client.id, clientNom: e.client.nom, natureClient: e.client.nature,
      codeInsee: e.ligne.codeInsee, commune: e.ligne.commune, profession: e.ligne.profession,
      origine: e.ligne.origine, niveauApl: e.ligne.niveauApl,
      action: e.action, niveauAvant: e.avant, niveauApres: e.apres,
      justification: e.justification?.trim() || null,
      auteurId: e.auteur.id, auteurNom: e.auteur.nom.slice(0, 160),
      motif: e.motif?.slice(0, 300) ?? null,
    },
  });
}

/**
 * Peut-on poser la case (codeInsee, profession) pour ce client ? Ne crée rien. Si une ligne
 * éteinte d'un autre client occupe la case, `reprise` la désigne : `poserCase` la retire dans la
 * même transaction que la création.
 */
export async function controlerCase(
  client: ClientCase,
  codeInsee: string,
  profession: Profession,
  maintenant: Date = new Date(),
): Promise<ControleCase> {
  const existante = await prisma.prioriteTerritoriale.findUnique({
    where: { codeInsee_profession: { codeInsee, profession } },
    include: { client: { select: { id: true, nom: true, type: true, nature: true, clotureLe: true, debutLe: true, revueLe: true } } },
  });
  let reprise: { ligne: PrioriteTerritoriale; client: ClientCase } | null = null;
  if (existante) {
    if (existante.clientId === client.id) {
      return { ok: false, conflit: "meme-institution", error: `${existante.commune} est déjà prioritaire pour cette profession chez ${client.nom}. Modifier la case existante plutôt que d'en ajouter une seconde.` };
    }
    if (vivante(existante, maintenant)) {
      return { ok: false, conflit: "chevauchement", error: `${existante.commune} est déjà prioritaire pour cette profession, tenue par ${existante.client.nom} (premier arrivé). La case se libère à l'extinction de sa déclaration ; d'ici là, à arbitrer entre les deux structures.` };
    }
    const { client: c, ...ligne } = existante;
    reprise = { ligne, client: { id: c.id, nom: c.nom, type: c.type, nature: c.nature } };
  }
  const { palier, casesMax } = limitesDuType(client.type);
  if (casesMax !== null && (await casesTenues(client.id, maintenant)) >= casesMax) {
    return { ok: false, conflit: "plafond", error: `L'offre ${palier} compte ${casesMax} cases prioritaires au plus — retirer une case avant d'en ajouter une.` };
  }
  return { ok: true, reprise };
}

/** Crée la case après un contrôle positif, et la journalise — en retirant (et journalisant au
 *  nom de son ancien titulaire) la ligne éteinte qu'elle reprend. Une seule transaction. */
export async function poserCase<T extends PrioriteTerritoriale>(
  controle: Extract<ControleCase, { ok: true }>,
  client: ClientCase,
  auteur: Auteur,
  creer: (db: Db, noteReprise: string | null) => Promise<T>,
): Promise<T> {
  const reprise = controle.reprise;
  return prisma.$transaction(async (tx) => {
    if (reprise) {
      await tx.prioriteTerritoriale.delete({ where: { id: reprise.ligne.id } });
      await journaliser(tx, {
        client: reprise.client, ligne: reprise.ligne, action: "RETRAIT",
        avant: reprise.ligne.niveau, apres: null, auteur,
        motif: `Case éteinte reprise par ${client.nom}.`,
      });
    }
    const cree = await creer(tx, reprise ? `Case reprise de ${reprise.client.nom} (déclaration éteinte).` : null);
    await journaliser(tx, {
      client, ligne: cree, action: "CREATION", avant: null, apres: cree.niveau,
      justification: cree.justification, auteur,
      motif: reprise ? `Reprise de ${reprise.client.nom}.` : null,
    });
    return cree;
  });
}

/** Change le niveau d'une case (déjà validé par `erreurReglage`) et le journalise. */
export async function reglerCase(
  ligne: PrioriteTerritoriale,
  client: ClientCase,
  auteur: Auteur,
  data: { niveau: number; justification: string | null; niveauApl?: number | null },
  motif: string | null = null,
): Promise<PrioriteTerritoriale> {
  return prisma.$transaction(async (tx) => {
    const apres = await tx.prioriteTerritoriale.update({ where: { id: ligne.id }, data });
    await journaliser(tx, {
      client, ligne: apres, action: "MODIFICATION", avant: ligne.niveau, apres: apres.niveau,
      justification: apres.justification, auteur, motif,
    });
    return apres;
  });
}

/** Retire des cases et journalise chaque retrait. */
export async function retirerCases(
  lignes: PrioriteTerritoriale[],
  client: ClientCase,
  auteur: Auteur,
  motif: string | null = null,
): Promise<number> {
  if (lignes.length === 0) return 0;
  return prisma.$transaction(async (tx) => {
    const n = (await tx.prioriteTerritoriale.deleteMany({ where: { id: { in: lignes.map((l) => l.id) } } })).count;
    for (const l of lignes) {
      await journaliser(tx, { client, ligne: l, action: "RETRAIT", avant: l.niveau, apres: null, auteur, motif });
    }
    return n;
  });
}
