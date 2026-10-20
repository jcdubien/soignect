import { prisma } from "@/lib/prisma";
import { COMMUNES_BY_ZONE, ZONE_LABELS, inseeOfCommune } from "@/lib/communes";
import { PERIMETRE_MAX, relationActive } from "@/lib/pageClient";
import { appBaseUrl } from "@/lib/appUrl";
import PagesClient from "./PagesClient";

export const dynamic = "force-dynamic";

// Pages clients (20/10) — une page hébergée par client institutionnel, servie par lien.
// L'administrateur règle ce qui découle de l'offre (périmètre) ; le client règle le reste
// depuis son lien d'édition.
export default async function AdminPagesPage() {
  const clients = await prisma.clientInstitutionnel.findMany({
    orderBy: { nom: "asc" },
    include: { page: true, _count: { select: { priorites: true } } },
  });
  const base = appBaseUrl();
  const zones = COMMUNES_BY_ZONE.map((z) => ({
    zone: ZONE_LABELS[z.zone],
    communes: z.communes
      .map((c) => ({ libelle: c, code: inseeOfCommune(c) }))
      .filter((c): c is { libelle: string; code: string } => !!c.code),
  })).filter((z) => z.communes.length > 0);

  return (
    <PagesClient
      zones={zones}
      clients={clients.map((c) => ({
        id: c.id, nom: c.nom, type: c.type, nature: c.nature,
        active: relationActive(c), revueLe: c.revueLe.toISOString(),
        max: PERIMETRE_MAX[c.type],
        priorites: c._count.priorites,
        page: c.page ? {
          communes: c.page.communes,
          demo: c.page.demo,
          lienPublic: `${base}/p/${c.page.jetonPublic}`,
          lienEdition: `${base}/gestion/${c.page.jetonEdition}`,
        } : null,
      }))}
    />
  );
}
