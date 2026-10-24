import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { ZONE_LABELS, zoneOfCommune } from "@/lib/communes";
import { libellesDuCode, prioritesDeLaPage, relationActive } from "@/lib/pageClient";
import PostesDuTerritoire from "@/components/territoire/PostesDuTerritoire";
import { besoinsPublics } from "@/lib/besoinsPublics";
import BlocBesoinsPublics from "@/components/territoire/BlocBesoinsPublics";

export const dynamic = "force-dynamic";

// Page hébergée d'un client institutionnel (20/10) — voir le modèle `PageClient`.
//
// Servie par un LIEN que le client diffuse lui-même, sans rien intégrer à son site : c'est tout
// ce qui la distingue du module embarquable, dont elle reprend le rendu (PostesDuTerritoire).
// Hors du groupe (app) : pas de navigation Soignect, la page est celle du client.
// Non indexée : le jeton n'a pas vocation à circuler au-delà de ceux à qui le client l'envoie.
//
// LE NOM DU CLIENT (20/10). Une page circule : elle ne publie le nom d'une CPTS que si son
// accord est noté dans /admin/pages (`accord` = OUI). Sans lui, ni en-tête, ni titre d'onglet,
// ni « zones prioritaires de … » — la page parle du territoire. Une page de démonstration porte
// un bandeau « Démonstration » tant que l'accord n'est pas OUI.

async function charger(jeton: string) {
  return prisma.pageClient.findUnique({
    where: { jetonPublic: jeton },
    include: { client: { select: { id: true, nom: true, logoUrl: true, debutLe: true, revueLe: true, clotureLe: true } } },
  });
}

export async function generateMetadata(
  { params }: { params: Promise<{ jeton: string }> },
): Promise<Metadata> {
  const { jeton } = await params;
  const page = await charger(jeton);
  return {
    title: page?.accord === "OUI" ? `Postes de santé — ${page.client.nom}` : "Postes de santé — Soignect",
    robots: { index: false, follow: false },
  };
}

export default async function PageClientPublique({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const page = await charger(jeton);
  if (!page) notFound();
  const nomPublie = page.accord === "OUI" ? page.client.nom : null;
  const demonstration = (page.demo || page.accord === "DEMO") && page.accord !== "OUI";

  const enveloppe = (contenu: React.ReactNode) => (
    <main className="min-h-screen bg-white text-[#1f2937]">
      <div className="max-w-2xl mx-auto px-4 py-6" style={{ fontSize: 14 }}>
        {demonstration && (
          <p className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 mt-0 mb-3">
            Démonstration — page d&apos;exemple, non publiée par une institution.
          </p>
        )}
        {/* Logo (23/10) : seulement avec l'accord de la structure, et jamais sur une page de
            démonstration (même si l'accord est noté). */}
        {nomPublie && !page.demo && page.client.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.client.logoUrl} alt={`Logo de ${nomPublie}`} className="h-12 w-auto max-w-[180px] object-contain mb-2" />
        )}
        {nomPublie && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide m-0">{nomPublie}</p>}
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
  const [priorites, apl, besoins] = await Promise.all([
    prioritesDeLaPage(page, page.client.nom),
    prisma.communeAPL.aggregate({ where: { codeInsee: { in: page.communes } }, _max: { aplAnnee: true } }),
    // Besoins du territoire de CETTE structure (24/10) — aucun sur une page de démonstration.
    page.demo ? Promise.resolve([]) : besoinsPublics({ clientId: page.clientId }),
  ]);

  // Les noms jusqu'à trois communes (« Pointe-Noire » pour une MSP), puis la zone si elles en
  // forment une (« Nord Basse-Terre »), sinon leur nombre.
  const zones = Array.from(new Set(communes.map(zoneOfCommune)));
  const territoire =
    communes.length <= 3 ? communes.join(", ")
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
          destinataire={nomPublie ?? ""}
          territoire={territoire}
          trace={`page-${page.id}`}
          anneeApl={apl._max.aplAnnee}
          attribuee={!page.demo && nomPublie !== null}
        />
      </div>
      <BlocBesoinsPublics
        besoins={besoins}
        titre="Les besoins de notre territoire"
        libelleProfession={(b) => b.profession}
        lienInscription={`/register?src=page-${page.id}`}
      />
    </>,
  );
}
