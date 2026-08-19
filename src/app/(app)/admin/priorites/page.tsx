import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { COMMUNES_GUADELOUPE, inseeOfCommune } from "@/lib/communes";
import { libelleProfession } from "@/lib/pagesDiffusion";
import PrioritesClient from "./PrioritesClient";

export const dynamic = "force-dynamic";

// Écran de déclaration des priorités territoriales (section 214, B3).
//
// CO-SAISI, PAS SELF-SERVICE : cet écran est fait pour être rempli PENDANT l'échange avec
// l'institution, par un administrateur. Sur une dizaine d'annonces, ouvrir un portail partenaire
// aurait été disproportionné — et `saisiParId` garde qui a tenu le stylo, ce qu'un self-service
// aurait perdu.
export default async function AdminPrioritesPage() {
  const priorites = await prisma.prioriteTerritoriale.findMany({
    orderBy: [{ profession: "asc" }, { commune: "asc" }],
    include: { saisiPar: { select: { email: true } }, client: { select: { nom: true, nature: true, revueLe: true, clotureLe: true } } },
  });

  // Les relations vivent sur le MÊME écran que les déclarations, pas sur un écran voisin : une
  // déclaration n'a d'effet que si sa relation est active, et séparer les deux inviterait à
  // saisir la seconde sans regarder la première.
  const clients = await prisma.clientInstitutionnel.findMany({
    orderBy: [{ clotureLe: "asc" }, { revueLe: "asc" }],
    include: { _count: { select: { priorites: true } } },
  });

  // Seules les communes que le PONT connaît sont proposées. Une commune absente produirait une
  // déclaration sans effet — l'API la refuse déjà, mais mieux vaut ne pas la proposer que
  // laisser un administrateur la choisir puis se faire jeter.
  const communes = COMMUNES_GUADELOUPE.filter((c) => inseeOfCommune(c) !== null);

  // DÉRIVÉE DE L'ENUM, PLUS RECOPIÉE (19/08, audit de généricité). La liste était écrite à la
  // main dans le composant : une 6ᵉ profession ajoutée à `Profession` n'y serait jamais apparue,
  // sans erreur de compilation — la colonne l'aurait acceptée, le formulaire ne l'aurait pas
  // proposée. L'enum est ce que la colonne accepte, c'est donc elle qui fait foi ici ; le
  // vocabulaire, lui, reste déclaré (`libelleProfession`) et non translittéré.
  const professions = Object.values(Profession).map((valeur) => ({
    value: valeur,
    label: libelleProfession(valeur),
  }));

  return (
    <PrioritesClient
      initialData={JSON.parse(JSON.stringify(priorites))}
      initialClients={JSON.parse(JSON.stringify(clients))}
      communes={communes}
      professions={professions}
    />
  );
}
