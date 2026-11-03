import { prisma } from "@/lib/prisma";
import { exigerAdmin } from "@/lib/exigerAdmin";
import { CRITERES_VITRINE, STATUTS_VITRINE, vitrinePublique } from "@/lib/vitrineTerritoire";
import { MENTION_LIEN_ADMIN } from "@/lib/besoinTerritoire";
import { structureLieeAdmin } from "@/lib/besoinTerritoireServeur";
import VitrinesClient from "./VitrinesClient";

export const dynamic = "force-dynamic";

// Vitrines du territoire (02/11) — à valider (première publication, ou republication après un
// retrait), puis toutes les autres, avec le retrait d'une vitrine publiée.
export default async function AdminVitrinesPage() {
  await exigerAdmin();
  const vitrines = await prisma.vitrineTerritoire.findMany({
    orderBy: [{ statut: "asc" }, { updatedAt: "desc" }],
    include: { client: { select: { nom: true, page: { select: { jetonPublic: true } } } } },
  });
  const liees = new Set((await Promise.all(vitrines.filter((v) => v.statut === "A_VALIDER").map(async (v) => ((await structureLieeAdmin(v.clientId)) ? v.clientId : null)))).filter(Boolean));
  return (
    <VitrinesClient
      criteres={CRITERES_VITRINE}
      mentionLien={MENTION_LIEN_ADMIN}
      vitrines={vitrines.map((v) => ({
        id: v.id, structure: v.client.nom, statut: v.statut, libelleStatut: STATUTS_VITRINE[v.statut],
        liee: liees.has(v.clientId), motif: v.motifRefus, majLe: v.updatedAt.toISOString(),
        lienPublic: v.client.page ? `/p/${v.client.page.jetonPublic}` : null,
        contenu: vitrinePublique(v),
      }))}
    />
  );
}
