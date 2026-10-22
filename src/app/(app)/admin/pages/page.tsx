import { prisma } from "@/lib/prisma";
import { COMMUNES_BY_ZONE, ZONE_LABELS, inseeOfCommune } from "@/lib/communes";
import { relationActive } from "@/lib/pageClient";
import { LIBELLE_PALIER, PALIER_DU_TYPE, limitesDuClient } from "@/lib/tarifsPartenaire";
import { appBaseUrl } from "@/lib/appUrl";
import PagesClient from "./PagesClient";
import { mesureDuClient } from "@/lib/mesureTerritoriale";

export const dynamic = "force-dynamic";

// Pages clients (20/10) — une page hébergée par client institutionnel, servie par lien.
// L'administrateur règle ce qui découle de l'offre (périmètre) ; le client règle le reste
// depuis son lien d'édition.
export default async function AdminPagesPage() {
  const clients = await prisma.clientInstitutionnel.findMany({
    orderBy: { nom: "asc" },
    include: {
      page: true,
      _count: { select: { priorites: true } },
      editeurs: { where: { retireLe: null }, orderBy: { createdAt: "asc" }, include: { user: { select: { email: true } } } },
    },
  });
  // Mesure (point 10) : même verrou de lecture et même seuil que côté client — l'administration
  // n'a pas de passe-droit sur les résultats.
  const mesures = new Map(await Promise.all(clients.map(async (c) => {
    const m = await mesureDuClient(c);
    return [c.id, m.verrouillee ? { verrouillee: true as const, ouvertureLe: m.ouvertureLe.toISOString() } : m] as const;
  })));
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
        max: limitesDuClient(c).communesMax,
        casesMax: limitesDuClient(c).casesMax,
        palier: c.palier,
        palierDuType: PALIER_DU_TYPE[c.type] ? LIBELLE_PALIER[PALIER_DU_TYPE[c.type]!] : null,
        gratuit: limitesDuClient(c).gratuit,
        mesure: mesures.get(c.id)!,
        priorites: c._count.priorites,
        editeurs: c.editeurs.map((e) => ({ id: e.id, nom: e.nom, fonction: e.fonction, email: e.user.email })),
        page: c.page ? {
          communes: c.page.communes,
          demo: c.page.demo,
          accord: c.page.accord,
          lienPublic: `${base}/p/${c.page.jetonPublic}`,
          lienEdition: `${base}/gestion/${c.page.jetonEdition}`,
        } : null,
      }))}
    />
  );
}
