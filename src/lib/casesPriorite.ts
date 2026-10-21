// Cases prioritaires : unicité, chevauchement et plafond par palier (point 7, 21/10).
//
// Une CASE est une ligne `PrioriteTerritoriale` : une commune × une profession. Les trois chemins
// qui en créent (ajout depuis /gestion, déclaration dans /admin/priorites, recalcul APL depuis
// /admin/pages) passent tous par `controlerCase` — une seule règle, écrite une fois.
//
// RÈGLE DE CHEVAUCHEMENT (MSP, établissement, CPTS sur une même commune) — PREMIER ARRIVÉ :
//   1. Une case n'a qu'un titulaire (contrainte `@@unique([codeInsee, profession])`). Pas de
//      double étiquette, pas de cumul des boosts.
//   2. Tant que la déclaration du titulaire est VIVANTE (non échue, relation client active), la
//      case lui reste — même si la structure qui arrive ensuite est plus locale (une MSP dans le
//      territoire d'une CPTS) ou paie plus. Elle est refusée, avec le nom du titulaire.
//   3. Quand cette déclaration s'éteint (échéance, revue dépassée, clôture), la case se libère :
//      la structure suivante peut la reprendre. La ligne éteinte est remplacée, sa trace gardée
//      dans la note de la nouvelle.
//   4. Le produit ne tranche jamais entre deux structures vivantes : c'est à elles de s'entendre,
//      et à l'administrateur de retirer la case à la demande de son titulaire.
//
// PLAFOND : MSP 8 cases, établissement 16, CPTS sans plafond (soumise à la densité du fil) —
// grille `TARIFS_PARTENAIRE` (lib/tarifsPartenaire), source unique.

import { prisma } from "@/lib/prisma";
import type { Prisma, Profession, TypeInstitution } from "@prisma/client";
import { limitesDuType } from "@/lib/tarifsPartenaire";

export type ControleCase =
  | { ok: true; reprise: { id: string; ancienTitulaire: string } | null }
  | { ok: false; conflit: "meme-institution" | "chevauchement" | "plafond"; error: string };

function vivante(
  l: { expireLe: Date | null; client: { clotureLe: Date | null; debutLe: Date; revueLe: Date } },
  maintenant: Date,
): boolean {
  return (l.expireLe === null || l.expireLe > maintenant)
    && l.client.clotureLe === null && l.client.debutLe <= maintenant && l.client.revueLe > maintenant;
}

/** Cases tenues par un client : ses lignes non échues. */
export async function casesTenues(clientId: string, maintenant: Date = new Date()): Promise<number> {
  return prisma.prioriteTerritoriale.count({
    where: { clientId, OR: [{ expireLe: null }, { expireLe: { gt: maintenant } }] },
  });
}

/**
 * Peut-on poser la case (codeInsee, profession) pour ce client ? Ne crée rien. Si une ligne
 * éteinte d'un autre client occupe la case, `reprise` la désigne : l'appelant la supprime dans
 * la même transaction que la création (`poserCase`).
 */
export async function controlerCase(
  client: { id: string; nom: string; type: TypeInstitution },
  codeInsee: string,
  profession: Profession,
  maintenant: Date = new Date(),
): Promise<ControleCase> {
  const existante = await prisma.prioriteTerritoriale.findUnique({
    where: { codeInsee_profession: { codeInsee, profession } },
    select: {
      id: true, clientId: true, commune: true, expireLe: true,
      client: { select: { nom: true, clotureLe: true, debutLe: true, revueLe: true } },
    },
  });
  let reprise: { id: string; ancienTitulaire: string } | null = null;
  if (existante) {
    if (existante.clientId === client.id) {
      return { ok: false, conflit: "meme-institution", error: `${existante.commune} est déjà prioritaire pour cette profession chez ${client.nom}. Modifier la case existante plutôt que d'en ajouter une seconde.` };
    }
    if (vivante(existante, maintenant)) {
      return { ok: false, conflit: "chevauchement", error: `${existante.commune} est déjà prioritaire pour cette profession, tenue par ${existante.client.nom} (premier arrivé). La case se libère à l'extinction de sa déclaration ; d'ici là, à arbitrer entre les deux structures.` };
    }
    reprise = { id: existante.id, ancienTitulaire: existante.client.nom };
  }
  const { palier, casesMax } = limitesDuType(client.type);
  if (casesMax !== null && (await casesTenues(client.id, maintenant)) >= casesMax) {
    return { ok: false, conflit: "plafond", error: `L'offre ${palier} compte ${casesMax} cases prioritaires au plus — retirer une case avant d'en ajouter une.` };
  }
  return { ok: true, reprise };
}

/** Crée la case après un contrôle positif — en supprimant, dans la même transaction, la ligne
 *  éteinte qu'elle reprend. La note de la nouvelle ligne garde la trace de la reprise. */
export async function poserCase<T>(
  controle: Extract<ControleCase, { ok: true }>,
  creer: (db: Prisma.TransactionClient, noteReprise: string | null) => Promise<T>,
): Promise<T> {
  const reprise = controle.reprise;
  return prisma.$transaction(async (tx) => {
    if (reprise) await tx.prioriteTerritoriale.delete({ where: { id: reprise.id } });
    return creer(tx, reprise ? `Case reprise de ${reprise.ancienTitulaire} (déclaration éteinte).` : null);
  });
}
