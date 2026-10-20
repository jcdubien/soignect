import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Profession, TypeInstitution } from "@prisma/client";
import { libellesDuCode } from "@/lib/communes";
import { paliersApl } from "@/lib/aplPalier";
import { zonesPrioritairesDuClient, type ZonePrioritaire } from "@/lib/territoire";

// Page hébergée d'un client institutionnel (20/10) — voir le modèle `PageClient`.
//
// La page et le module embarquable montrent la MÊME chose (composant PostesDuTerritoire) ; ce
// fichier porte ce qui est propre à la page : jetons, périmètre borné par l'offre, priorités
// recalculées depuis l'APL.

export function nouveauJeton(): string {
  return randomBytes(18).toString("base64url");
}

/** Nombre de communes que l'offre souscrite couvre (grille lib/tarifsPartenaire) — null = sans
 *  plafond (CPTS, collectivité : « tout votre territoire » ; hôpital : sur devis). */
export const PERIMETRE_MAX: Record<TypeInstitution, number | null> = {
  MSP: 1,
  EHPAD: 2, SSIAD: 2, SSR: 2, CLINIQUE: 2,
  CPTS: null, COLLECTIVITE: null, HOPITAL: null, ARS: null, CGSS: null, AUTRE: null,
};

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
 * retiré). Un administrateur Soignect peut toujours modifier : il est lui aussi nommé.
 */
export async function editeurConnecte(clientId: string): Promise<{ userId: string; nom: string } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  if (session.user.role === "ADMIN") return { userId, nom: "Administrateur Soignect" };
  const e = await prisma.editeurClient.findFirst({
    where: { clientId, userId, retireLe: null },
    select: { nom: true },
  });
  return e ? { userId, nom: e.nom } : null;
}

/**
 * Aligne les priorités `APL` du client sur l'APL en base, pour son périmètre.
 *   · crée ou met à jour une ligne par commune × profession au niveau > 0 ;
 *   · retire les lignes `APL` du client tombées à 0 ou sorties du périmètre ;
 *   · ne touche JAMAIS une ligne `DECLAREE` : ce qu'un humain a déclaré n'est pas un calcul ;
 *   · ne touche jamais la ligne d'un AUTRE client (une commune ne porte qu'une déclaration par
 *     profession — contrainte d'unicité) : elle est comptée dans `ignorees`.
 * À relancer après chaque import de millésime (scripts/sync-commune-apl.mjs), ou après un
 * changement de périmètre.
 */
export async function synchroniserPrioritesApl(
  clientId: string,
  saisiParId: string,
): Promise<{ creees: number; modifiees: number; retirees: number; ignorees: number }> {
  const page = await prisma.pageClient.findUniqueOrThrow({ where: { clientId } });
  // Une page de démonstration n'écrit rien : ses priorités se calculent à l'affichage.
  if (page.demo) return { creees: 0, modifiees: 0, retirees: 0, ignorees: 0 };
  const paliers = await paliersApl(page.communes);
  const existantes = await prisma.prioriteTerritoriale.findMany({
    where: { codeInsee: { in: page.communes } },
  });
  const cle = (code: string, p: Profession) => `${code}|${p}`;
  const parCle = new Map(existantes.map((e) => [cle(e.codeInsee, e.profession), e]));
  const bilan = { creees: 0, modifiees: 0, retirees: 0, ignorees: 0 };
  const voulues = new Set<string>();

  for (const p of paliers) {
    if (p.niveau <= 0) continue;
    const k = cle(p.codeInsee, p.profession);
    voulues.add(k);
    const note = `APL DREES${p.annee ? ` ${p.annee}` : ""} : ${p.apl}, rang ${p.rang}/${p.sur} dans le département.`;
    const e = parCle.get(k);
    if (!e) {
      await prisma.prioriteTerritoriale.create({
        data: {
          codeInsee: p.codeInsee, commune: libellesDuCode(p.codeInsee)[0] ?? p.commune,
          profession: p.profession, niveau: p.niveau, origine: "APL", note,
          clientId, saisiParId, declareLe: new Date(),
        },
      });
      bilan.creees++;
    } else if (e.clientId !== clientId || e.origine !== "APL") {
      bilan.ignorees++;
    } else if (e.niveau !== p.niveau || e.note !== note) {
      await prisma.prioriteTerritoriale.update({ where: { id: e.id }, data: { niveau: p.niveau, note } });
      bilan.modifiees++;
    }
  }

  const aRetirer = await prisma.prioriteTerritoriale.findMany({
    where: { clientId, origine: "APL" },
    select: { id: true, codeInsee: true, profession: true },
  });
  const ids = aRetirer.filter((e) => !voulues.has(cle(e.codeInsee, e.profession))).map((e) => e.id);
  if (ids.length > 0) {
    bilan.retirees = (await prisma.prioriteTerritoriale.deleteMany({ where: { id: { in: ids } } })).count;
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
