import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Profession, TypeInstitution } from "@prisma/client";
import { libellesDuCode } from "@/lib/communes";
import { paliersApl } from "@/lib/aplPalier";
import { PALIER_DU_TYPE, limitesDuType } from "@/lib/tarifsPartenaire";
import { controlerCase, poserCase } from "@/lib/casesPriorite";
import { zonesPrioritairesDuClient, type ZonePrioritaire } from "@/lib/territoire";

// Page hébergée d'un client institutionnel (20/10) — voir le modèle `PageClient`.
//
// La page et le module embarquable montrent la MÊME chose (composant PostesDuTerritoire) ; ce
// fichier porte ce qui est propre à la page : jetons, périmètre borné par l'offre, priorités
// recalculées depuis l'APL.

export function nouveauJeton(): string {
  return randomBytes(18).toString("base64url");
}

/** Nombre de communes que l'offre souscrite couvre — dérivé de la grille (lib/tarifsPartenaire,
 *  source unique), null = sans plafond. */
export const PERIMETRE_MAX = Object.fromEntries(
  (Object.keys(PALIER_DU_TYPE) as TypeInstitution[]).map((t) => [t, limitesDuType(t).communesMax]),
) as Record<TypeInstitution, number | null>;

export { libellesDuCode };

/** Une relation client vivante — la même règle que celle qui active les priorités dans le fil
 *  (lib/territoire, `declarationVivante`). Hors abonnement, la page ne sert plus rien. */
export function relationActive(
  client: { debutLe: Date; revueLe: Date; clotureLe: Date | null },
  maintenant: Date = new Date(),
): boolean {
  return client.clotureLe === null && client.debutLe <= maintenant && client.revueLe > maintenant;
}

/**
 * L'éditeur NOMMÉ connecté pour ce client (section 314), ou null. Le jeton d'édition ne fait que
 * désigner la page ; modifier exige une session sur un compte rattaché (`EditeurClient`, non
 * retiré). Un administrateur Soignect peut toujours modifier : il est lui aussi nommé — sous son
 * nom d'éditeur s'il est rattaché à ce client, sinon « Administrateur Soignect ».
 */
export async function editeurConnecte(clientId: string): Promise<{ userId: string; nom: string } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const e = await prisma.editeurClient.findFirst({
    where: { clientId, userId, retireLe: null },
    select: { nom: true },
  });
  if (e) return { userId, nom: e.nom };
  return session.user.role === "ADMIN" ? { userId, nom: "Administrateur Soignect" } : null;
}

/**
 * Aligne les priorités `APL` du client sur l'APL en base, pour son périmètre.
 *   · retire d'abord les lignes `APL` du client tombées à 0 ou sorties du périmètre ;
 *   · met à jour ses lignes `APL` restantes, crée les manquantes — les plus fortes d'abord,
 *     jusqu'au plafond de cases de son offre (point 7 : `horsPlafond` compte le reste) ;
 *   · ne touche JAMAIS une ligne `DECLAREE` : ce qu'un humain a déclaré n'est pas un calcul ;
 *   · une case tenue par un AUTRE client vivant est comptée dans `ignorees` (premier arrivé) ;
 *     tenue par une déclaration éteinte, elle est reprise (`reprises`) — lib/casesPriorite.
 * À relancer après chaque import de millésime (scripts/sync-commune-apl.mjs), ou après un
 * changement de périmètre.
 */
export async function synchroniserPrioritesApl(
  clientId: string,
  saisiParId: string,
): Promise<{ creees: number; modifiees: number; retirees: number; ignorees: number; reprises: number; horsPlafond: number }> {
  const page = await prisma.pageClient.findUniqueOrThrow({
    where: { clientId },
    include: { client: { select: { id: true, nom: true, type: true } } },
  });
  const bilan = { creees: 0, modifiees: 0, retirees: 0, ignorees: 0, reprises: 0, horsPlafond: 0 };
  // Une page de démonstration n'écrit rien : ses priorités se calculent à l'affichage.
  if (page.demo) return bilan;
  const cle = (code: string, p: Profession) => `${code}|${p}`;
  const paliers = (await paliersApl(page.communes))
    .filter((p) => p.niveau > 0)
    .sort((a, b) => b.niveau - a.niveau);
  const voulues = new Set(paliers.map((p) => cle(p.codeInsee, p.profession)));

  const aRetirer = await prisma.prioriteTerritoriale.findMany({
    where: { clientId, origine: "APL" },
    select: { id: true, codeInsee: true, profession: true },
  });
  const ids = aRetirer.filter((e) => !voulues.has(cle(e.codeInsee, e.profession))).map((e) => e.id);
  if (ids.length > 0) {
    bilan.retirees = (await prisma.prioriteTerritoriale.deleteMany({ where: { id: { in: ids } } })).count;
  }

  const existantes = await prisma.prioriteTerritoriale.findMany({
    where: { codeInsee: { in: page.communes }, clientId },
  });
  const parCle = new Map(existantes.map((e) => [cle(e.codeInsee, e.profession), e]));

  for (const p of paliers) {
    const note = `APL DREES${p.annee ? ` ${p.annee}` : ""} : ${p.apl}, rang ${p.rang}/${p.sur} dans le département.`;
    const e = parCle.get(cle(p.codeInsee, p.profession));
    if (e) {
      if (e.origine === "APL" && (e.niveau !== p.niveau || e.note !== note)) {
        await prisma.prioriteTerritoriale.update({ where: { id: e.id }, data: { niveau: p.niveau, note } });
        bilan.modifiees++;
      }
      continue;
    }
    const controle = await controlerCase(page.client, p.codeInsee, p.profession);
    if (!controle.ok) {
      if (controle.conflit === "plafond") bilan.horsPlafond++; else bilan.ignorees++;
      continue;
    }
    await poserCase(controle, (db, noteReprise) => db.prioriteTerritoriale.create({
      data: {
        codeInsee: p.codeInsee, commune: libellesDuCode(p.codeInsee)[0] ?? p.commune,
        profession: p.profession, niveau: p.niveau, origine: "APL",
        note: noteReprise ? `${note} ${noteReprise}` : note,
        clientId, saisiParId, declareLe: new Date(),
      },
    }));
    bilan.creees++;
    if (controle.reprise) bilan.reprises++;
  }
  return bilan;
}

/** Les zones prioritaires qu'une page affiche, plus fortes d'abord.
 *  · page réelle : les déclarations vivantes du client (APL et déclarées), sur son périmètre ;
 *  · page de démonstration : l'APL seul, calculé à l'affichage — rien n'est en base. */
export async function prioritesDeLaPage(
  page: { demo: boolean; communes: string[] },
  clientNom: string,
): Promise<ZonePrioritaire[]> {
  if (page.demo) {
    return (await paliersApl(page.communes))
      .filter((p) => p.niveau > 0)
      .sort((a, b) => b.niveau - a.niveau)
      .map((p) => ({
        commune: libellesDuCode(p.codeInsee)[0] ?? p.commune,
        codeInsee: p.codeInsee, profession: p.profession, niveau: p.niveau,
      }));
  }
  const codes = new Set(page.communes);
  return (await zonesPrioritairesDuClient(clientNom)).filter((z) => codes.has(z.codeInsee));
}
