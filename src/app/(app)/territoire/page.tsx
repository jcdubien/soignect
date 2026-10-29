import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Profession } from "@prisma/client";
import { statsTerritoire } from "@/lib/statsTerritoire";
import { libelleProfession } from "@/lib/pagesDiffusion";
import { COMMUNES_PAR_TERRITOIRE, TERRITOIRES, inseeOfCommune, territoireDe } from "@/lib/communes";
import { estAdmin } from "@/lib/roles";
import EspaceTerritoire from "./EspaceTerritoire";

export const dynamic = "force-dynamic";

// Espace partenaire territorial (section 233) — consultation et remontée, aucun réglage.
// Un espace PAR ÎLE (section 377) : le partenaire lit l'île de son compte, et elle seule.
// L'administrateur passe de l'une à l'autre (?ile=MARTINIQUE).
export default async function TerritoirePage({ searchParams }: { searchParams: Promise<{ ile?: string }> }) {
  const session = await auth();
  const admin = estAdmin(session!.user.role);
  const ile = admin ? territoireDe((await searchParams).ile ?? session!.user.territoire) : territoireDe(session!.user.territoire);
  const stats = await statsTerritoire(ile);

  const demandes = await prisma.demandePriorite.findMany({
    where: { demandeurId: session!.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, commune: true, profession: true, niveau: true, motif: true,
              statut: true, reponse: true, createdAt: true },
  });

  // Mêmes communes que l'écran de saisie réel : proposer une commune que le pont ne connaît pas
  // produirait une demande inapplicable, retenue puis impossible à saisir.
  const communes = COMMUNES_PAR_TERRITOIRE[ile].filter((c) => inseeOfCommune(c) !== null);
  const professions = Object.values(Profession).map((v) => ({ value: v, label: libelleProfession(v) }));

  return (
    <EspaceTerritoire
      stats={stats}
      demandes={JSON.parse(JSON.stringify(demandes))}
      communes={communes}
      professions={professions}
      territoire={ile}
      iles={admin ? TERRITOIRES : null}
    />
  );
}
