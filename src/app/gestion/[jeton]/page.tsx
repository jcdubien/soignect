import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { PROFESSION_LABELS } from "@/lib/professions";
import { paliersApl } from "@/lib/aplPalier";
import { editeurConnecte, libellesDuCode, prioritesDeLaPage, relationActive } from "@/lib/pageClient";
import { appBaseUrl } from "@/lib/appUrl";
import GestionClient from "./GestionClient";
import { mesureDuClient } from "@/lib/mesureTerritoriale";
import { recommandationsDeLaPage } from "@/lib/recommandationTerritoireServeur";
import { MENTION_RECOMMANDATION } from "@/lib/recommandationTerritoire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Réglages de votre page | Soignect", robots: { index: false, follow: false } };

// Réglages d'une page client par son lien d'édition (20/10) — voir le modèle `PageClient`.
// Le client y voit ce que sa page montre, pourquoi (l'APL de chaque commune), et qui la visite.
// Le lien seul ne donne que la CONSULTATION (section 314) : les réglages s'ouvrent à un éditeur
// nommé connecté.
export default async function GestionPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const page = await prisma.pageClient.findUnique({
    where: { jetonEdition: jeton },
    include: { client: { select: { id: true, nom: true, debutLe: true, revueLe: true, clotureLe: true } } },
  });
  if (!page) notFound();

  const active = relationActive(page.client);
  const editeur = await editeurConnecte(page.clientId);
  const [priorites, paliers, vues] = await Promise.all([
    // Démonstration : rien en base, les priorités affichées sont celles que la page calcule.
    page.demo
      ? prioritesDeLaPage(page, page.client.nom).then((zs) => zs.map((z) => ({
          ...z, id: `${z.codeInsee}-${z.profession}`, origine: "APL" as const, clientId: page.clientId,
          niveauApl: z.niveau, justification: null,
        })))
      : prisma.prioriteTerritoriale.findMany({
          where: { codeInsee: { in: page.communes } },
          select: { id: true, codeInsee: true, commune: true, profession: true, niveau: true, origine: true, clientId: true, niveauApl: true, justification: true },
          orderBy: [{ niveau: "desc" }, { commune: "asc" }],
        }),
    paliersApl(page.communes),
    prisma.traceEvent.findMany({
      where: { eventType: "LANDING_VIEW", metadata: { path: ["page"], equals: `page-${page.id}` } },
      select: { occurredAt: true, metadata: true },
    }),
  ]);
  // Journal des réglages (point 8) : montré aux seuls éditeurs connectés — il nomme les auteurs.
  const journal = editeur
    ? await prisma.journalReglage.findMany({
        where: { clientId: page.clientId }, orderBy: { createdAt: "desc" }, take: 50,
        select: { id: true, createdAt: true, commune: true, profession: true, action: true, niveauAvant: true, niveauApres: true, niveauApl: true, justification: true, auteurNom: true, motif: true, accesGratuit: true },
      })
    : [];
  const mesure = await mesureDuClient(page.client);
  // Encart « Recommandation Soignect » (23/10) : propositions calculées, rien d'appliqué ici.
  const reco = active ? await recommandationsDeLaPage(page) : null;
  const humaines = vues.filter((v) => !(v.metadata as { robot?: boolean } | null)?.robot);
  const il30j = Date.now() - 30 * 86400_000;

  return (
    <main className="min-h-screen bg-gray-50 text-[#1f2937]">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <GestionClient
          jeton={jeton}
          editeur={editeur ? { nom: editeur.nom } : null}
          lienConnexion={`/login?return_to=${encodeURIComponent(`/gestion/${jeton}`)}`}
          nom={page.client.nom}
          active={active}
          demo={page.demo}
          revueLe={page.client.revueLe.toISOString()}
          lienPublic={`${appBaseUrl()}/p/${page.jetonPublic}`}
          communes={page.communes.map((c) => ({ code: c, libelle: libellesDuCode(c)[0] ?? c }))}
          professionsToutes={Object.values(Profession).map((p) => ({ value: p, label: PROFESSION_LABELS[p] }))}
          initial={{ messageAccueil: page.messageAccueil ?? "", contact: page.contact ?? "", professions: page.professions }}
          priorites={priorites.map((p) => ({
            id: p.id, codeInsee: p.codeInsee, commune: p.commune, profession: p.profession,
            niveau: p.niveau, origine: p.origine, retirable: p.origine === "DECLAREE" && p.clientId === page.clientId,
            reglable: !page.demo && p.clientId === page.clientId,
            niveauApl: p.niveauApl, justification: p.justification,
          }))}
          mesure={mesure.verrouillee ? { verrouillee: true, ouvertureLe: mesure.ouvertureLe.toISOString() } : mesure}
          journal={journal.map((j) => ({ ...j, createdAt: j.createdAt.toISOString() }))}
          paliers={paliers}
          vues={{ total: humaines.length, trenteJours: humaines.filter((v) => v.occurredAt.getTime() >= il30j).length }}
          recommandation={reco ? { ...reco, mention: MENTION_RECOMMANDATION } : null}
        />
      </div>
    </main>
  );
}
