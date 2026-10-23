import { prisma } from "@/lib/prisma";
import { exigerAdmin } from "@/lib/exigerAdmin";
import { PROFESSION_LABELS } from "@/lib/professions";
import { NATURES_BESOIN } from "@/lib/besoinTerritoire";
import BesoinsClient from "./BesoinsClient";

export const dynamic = "force-dynamic";

// Besoins du territoire à valider (23/10) — première publication de chaque structure.
export default async function AdminBesoinsPage() {
  await exigerAdmin();
  const besoins = await prisma.besoinTerritoire.findMany({
    where: { statut: "A_VALIDER" }, orderBy: { updatedAt: "asc" },
    include: { client: { select: { nom: true } } },
  });
  return (
    <BesoinsClient
      besoins={besoins.map((b) => ({
        id: b.id, structure: b.client.nom, commune: b.commune,
        profession: PROFESSION_LABELS[b.profession] + (b.specialite ? ` — ${b.specialite}` : ""),
        nature: NATURES_BESOIN[b.nature], texte: b.texte, proposition: b.proposition,
        demandeLe: b.updatedAt.toISOString(),
      }))}
    />
  );
}
