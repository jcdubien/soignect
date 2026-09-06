import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Profession } from "@prisma/client";
import { statsTerritoire } from "@/lib/statsTerritoire";
import { libelleProfession } from "@/lib/pagesDiffusion";
import { COMMUNES_GUADELOUPE, inseeOfCommune } from "@/lib/communes";
import EspaceTerritoire from "./EspaceTerritoire";

export const dynamic = "force-dynamic";

// Espace partenaire territorial (section 233) — consultation et remontée, aucun réglage.
export default async function TerritoirePage() {
  const session = await auth();
  const stats = await statsTerritoire();

  const demandes = await prisma.demandePriorite.findMany({
    where: { demandeurId: session!.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, commune: true, profession: true, niveau: true, motif: true,
              statut: true, reponse: true, createdAt: true },
  });

  // Mêmes communes que l'écran de saisie réel : proposer une commune que le pont ne connaît pas
  // produirait une demande inapplicable, retenue puis impossible à saisir.
  const communes = COMMUNES_GUADELOUPE.filter((c) => inseeOfCommune(c) !== null);
  const professions = Object.values(Profession).map((v) => ({ value: v, label: libelleProfession(v) }));

  return (
    <EspaceTerritoire
      stats={stats}
      demandes={JSON.parse(JSON.stringify(demandes))}
      communes={communes}
      professions={professions}
    />
  );
}
