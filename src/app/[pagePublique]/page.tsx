import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pagePublieeDuSlug, metadonneesPage } from "@/lib/pagesDiffusion";
import PagePorte from "@/components/diffusion/PagePorte";
import PageTerritoire from "@/components/diffusion/PageTerritoire";

export const dynamic = "force-dynamic";

// ROUTE UNIQUE DES PAGES DE DIFFUSION (section 377) — /{porte}-{profession}-{territoire}.
//
// Treize dossiers recopiaient la même page à trois constantes près ; la Martinique en aurait
// ajouté onze. Le contenu vit dans lib/pagesDiffusion (registre PAGES_PUBLIEES) et cette route
// ne sert QUE ce qu'il déclare : tout autre chemin à la racine répond 404, comme avant. Les
// routes nommées (/annonces, /login, /p…) passent devant un segment dynamique : elles ne sont
// pas concernées.
type Params = { params: Promise<{ pagePublique: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = pagePublieeDuSlug((await params).pagePublique);
  return page ? metadonneesPage(page.porte, page.profession, page.territoire) : {};
}

export default async function Page({ params }: Params) {
  const page = pagePublieeDuSlug((await params).pagePublique);
  if (!page) notFound();
  // La porte TERRITOIRE ne suit pas le gabarit des autres : une CPTS pilote une offre de soins,
  // elle ne cherche pas un poste — sa page montre la répartition, pas un fil (section 212).
  return page.porte.slug === "territoire"
    ? <PageTerritoire profession={page.profession} territoire={page.territoire} />
    : <PagePorte porte={page.porte} profession={page.profession} territoire={page.territoire} />;
}
