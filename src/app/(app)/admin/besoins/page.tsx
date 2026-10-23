import { prisma } from "@/lib/prisma";
import { exigerAdmin } from "@/lib/exigerAdmin";
import { PROFESSION_LABELS } from "@/lib/professions";
import { NATURES_BESOIN, CRITERES_VALIDATION, MENTION_LIEN_ADMIN } from "@/lib/besoinTerritoire";
import { structureLieeAdmin } from "@/lib/besoinTerritoireServeur";
import BesoinsClient from "./BesoinsClient";

export const dynamic = "force-dynamic";

// Besoins du territoire à valider (23/10) — première publication de chaque structure.
export default async function AdminBesoinsPage() {
  await exigerAdmin();
  const besoins = await prisma.besoinTerritoire.findMany({
    where: { statut: "A_VALIDER" }, orderBy: { updatedAt: "asc" },
    include: { client: { select: { nom: true } } },
  });
  const liees = new Set((await Promise.all(Array.from(new Set(besoins.map((b) => b.clientId))).map(async (id) => ((await structureLieeAdmin(id)) ? id : null)))).filter(Boolean));
  return (
    <BesoinsClient
      criteres={CRITERES_VALIDATION}
      mentionLien={MENTION_LIEN_ADMIN}
      besoins={besoins.map((b) => ({
        liee: liees.has(b.clientId),
        id: b.id, structure: b.client.nom, commune: b.commune,
        profession: PROFESSION_LABELS[b.profession] + (b.specialite ? ` — ${b.specialite}` : ""),
        nature: NATURES_BESOIN[b.nature], texte: b.texte, proposition: b.proposition,
        demandeLe: b.updatedAt.toISOString(),
      }))}
    />
  );
}
