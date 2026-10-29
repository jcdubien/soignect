import { prisma } from "@/lib/prisma";
import { TERRITOIRES, LIBELLE_TERRITOIRE, communesParZoneDe, libellesDuCode } from "@/lib/communes";
import { PROFESSION_LABELS } from "@/lib/professions";
import { libelleTypePartenaire, nomClientPropose } from "@/lib/partenariat";
import { limitesDuClient } from "@/lib/tarifsPartenaire";
import PartenariatsClient from "./PartenariatsClient";
import { exigerAdmin } from "@/lib/exigerAdmin";

export const dynamic = "force-dynamic";

// Demandes de partenariat (22/10) — formulaire public /partenaire. L'accès admin est contrôlé
// par le layout /admin.
export default async function AdminPartenariatsPage() {
  await exigerAdmin();
  const demandes = await prisma.demandePartenariat.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const clients = await prisma.clientInstitutionnel.findMany({
    where: { id: { in: demandes.map((d) => d.clientId).filter((x): x is string => !!x) } },
    select: { id: true, nom: true },
  });
  // Les communes proposées à la conversion sont celles de l'île de la demande (section 379).
  const zonesParIle = Object.fromEntries(TERRITOIRES.map((t) => [t, communesParZoneDe(t)]));

  return (
    <PartenariatsClient
      zonesParIle={zonesParIle}
      demandes={demandes.map((d) => ({
        id: d.id, statut: d.statut, type: d.type, typeLibelle: libelleTypePartenaire(d.type),
        structure: d.structure, nomPropose: nomClientPropose(d), territoire: d.territoire, ile: LIBELLE_TERRITOIRE[d.territoire],
        contactNom: d.contactNom, fonction: d.fonction, email: d.email, telephone: d.telephone,
        communes: d.communes, communesLibelles: d.communes.map((c) => libellesDuCode(c)[0] ?? c),
        professions: d.professions.map((p) => PROFESSION_LABELS[p]),
        message: d.message, source: d.source, createdAt: d.createdAt.toISOString(),
        communesMax: limitesDuClient({ type: d.type }).communesMax,
        client: clients.find((c) => c.id === d.clientId)?.nom ?? null,
      }))}
    />
  );
}
