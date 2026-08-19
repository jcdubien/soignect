import { prisma } from "@/lib/prisma";
import { COMMUNES_GUADELOUPE, inseeOfCommune } from "@/lib/communes";
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
    include: { saisiPar: { select: { email: true } } },
  });

  // Seules les communes que le PONT connaît sont proposées. Une commune absente produirait une
  // déclaration sans effet — l'API la refuse déjà, mais mieux vaut ne pas la proposer que
  // laisser un administrateur la choisir puis se faire jeter.
  const communes = COMMUNES_GUADELOUPE.filter((c) => inseeOfCommune(c) !== null);

  return (
    <PrioritesClient
      initialData={JSON.parse(JSON.stringify(priorites))}
      communes={communes}
    />
  );
}
