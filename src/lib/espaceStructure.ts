import { prisma } from "@/lib/prisma";
import { relationActive } from "@/lib/pageClient";
import type { Territoire } from "@/lib/communes";

// ESPACE STRUCTURE (section 379) — ce qu'un compte de CPTS, de MSP, de collectivité ou
// d'établissement voit de ses structures partenaires.
//
// L'ACCÈS NAÎT DE LA VALIDATION, JAMAIS DE L'INSCRIPTION. Un compte qui se déclare CPTS n'a
// qu'une demande en attente ; c'est la conversion de cette demande par l'administrateur
// (/admin/partenariats) qui le rattache comme éditeur du client, par son email
// (lib/pageClient, `rattacherEditeur`). Rien ici ne donne accès à quoi que ce soit sans
// `EditeurClient` actif ET relation client vivante.

export interface StructureDuCompte {
  clientId: string;
  nom: string;
  type: string;
  territoire: Territoire;
  active: boolean;
  page: { jetonPublic: string; jetonEdition: string; demo: boolean } | null;
}

/** Les structures dont ce compte est éditeur nommé, non retiré. */
export async function structuresDuCompte(userId: string): Promise<StructureDuCompte[]> {
  const liens = await prisma.editeurClient.findMany({
    where: { userId, retireLe: null },
    include: {
      client: {
        select: {
          id: true, nom: true, type: true, territoire: true, debutLe: true, revueLe: true, clotureLe: true,
          page: { select: { jetonPublic: true, jetonEdition: true, demo: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return liens.map(({ client: c }) => ({
    clientId: c.id, nom: c.nom, type: c.type, territoire: c.territoire,
    active: relationActive(c), page: c.page,
  }));
}

/** L'île d'une structure ACTIVE de ce compte, ou null — ouvre l'Espace territoire de cette île
 *  (statistiques agrégées, signalement d'une zone en tension) à un compte sans rôle partenaire. */
export async function ileDeStructureActive(userId: string): Promise<Territoire | null> {
  const s = (await structuresDuCompte(userId)).find((x) => x.active);
  return s ? s.territoire : null;
}

/** Ce compte relève-t-il de l'espace structure : éditeur d'une structure, ou auteur d'une
 *  demande (par son email) ? Un compte sans profil soignant y est conduit plutôt qu'à
 *  l'inscription soignant. */
export async function compteDeLEspaceStructure(userId: string, email: string | null | undefined): Promise<boolean> {
  const [liens, demandes] = await Promise.all([
    prisma.editeurClient.count({ where: { userId, retireLe: null } }),
    email ? prisma.demandePartenariat.count({ where: { email: email.toLowerCase() } }) : Promise.resolve(0),
  ]);
  return liens + demandes > 0;
}
