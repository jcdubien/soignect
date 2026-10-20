import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { zonesPrioritairesDuClient } from "@/lib/territoire";
import { ZONE_LABELS, zoneOfCommune } from "@/lib/communes";
import { libellesDuCode, relationActive } from "@/lib/pageClient";
import PostesDuTerritoire from "@/components/territoire/PostesDuTerritoire";

export const dynamic = "force-dynamic";

// Page hébergée d'un client institutionnel (20/10) — voir le modèle `PageClient`.
//
// Servie par un LIEN que le client diffuse lui-même, sans rien intégrer à son site : c'est tout
// ce qui la distingue du module embarquable, dont elle reprend le rendu (PostesDuTerritoire).
// Hors du groupe (app) : pas de navigation Soignect, la page est celle du client.
// Non indexée : le jeton n'a pas vocation à circuler au-delà de ceux à qui le client l'envoie.

async function charger(jeton: string) {
  return prisma.pageClient.findUnique({
    where: { jetonPublic: jeton },
    include: { client: { select: { id: true, nom: true, debutLe: true, revueLe: true, clotureLe: true } } },
  });
}

export async function generateMetadata(
  { params }: { params: Promise<{ jeton: string }> },
): Promise<Metadata> {
  const { jeton } = await params;
  const page = await charger(jeton);
  return {
    title: page ? `Postes de santé — ${page.client.nom}` : "Soignect",
    robots: { index: false, follow: false },
  };
}

export default async function PageClientPublique({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const page = await charger(jeton);
  if (!page) notFound();

  const enveloppe = (contenu: React.ReactNode) => (
    <main className="min-h-screen bg-white text-[#1f2937]">
      <div className="max-w-2xl mx-auto px-4 py-6" style={{ fontSize: 14 }}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide m-0">{page.client.nom}</p>
        {contenu}
      </div>
    </main>
  );

  // Hors abonnement, la page ne sert plus de postes : elle le dit, au lieu d'une 404 qui
  // laisserait croire à un lien mal copié.
  if (!relationActive(page.client)) {
    return enveloppe(
      <p className="text-sm text-gray-600 mt-4">
        Cette page n&apos;est plus active. Les postes de santé de Guadeloupe restent consultables
        sur <a href="/annonces" className="underline text-[#0B3D5C]">Soignect</a>.
      </p>,
    );
  }

  const communes = page.communes.flatMap(libellesDuCode);
  const professions = page.professions.length > 0 ? page.professions : Object.values(Profession);
  const codes = new Set(page.communes);
  const [priorites, apl] = await Promise.all([
    zonesPrioritairesDuClient(page.client.nom).then((zs) => zs.filter((z) => codes.has(z.codeInsee))),
    prisma.communeAPL.aggregate({ where: { codeInsee: { in: page.communes } }, _max: { aplAnnee: true } }),
  ]);

  // « Pointe-Noire » pour une MSP, « Nord Basse-Terre » pour une CPTS dont les communes forment
  // une zone, sinon le nombre de communes.
  const zones = Array.from(new Set(communes.map(zoneOfCommune)));
  const territoire =
    communes.length === 1 ? communes[0]
    : zones.length === 1 && zones[0] ? ZONE_LABELS[zones[0]]
    : `${page.communes.length} communes`;

  return enveloppe(
    <>
      {page.messageAccueil && (
        <p className="text-sm text-gray-700 whitespace-pre-line mt-2 mb-0">{page.messageAccueil}</p>
      )}
      {page.contact && (
        <p className="text-xs text-gray-500 mt-2 mb-0 whitespace-pre-line">Contact : {page.contact}</p>
      )}
      <div className="mt-5">
        <PostesDuTerritoire
          zones={[]}
          communes={communes}
          professions={professions}
          priorites={priorites}
          destinataire={page.client.nom}
          territoire={territoire}
          trace={`page-${page.id}`}
          anneeApl={apl._max.aplAnnee}
        />
      </div>
    </>,
  );
}
