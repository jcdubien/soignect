import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EMBED_PAR_SLUG, cleTraceEmbed } from "@/lib/embedTerritoire";
import { zonesPrioritairesDuClient } from "@/lib/territoire";
import { COMMUNE_ZONE, ZONE_LABELS, inseeOfCommune } from "@/lib/communes";
import PostesDuTerritoire from "@/components/territoire/PostesDuTerritoire";

export const dynamic = "force-dynamic";

// Module Soignect embarquable sur un site de territoire (section 208).
// Premier destinataire : la CPTS Nord Basse-Terre, comme laboratoire de Soignect Territoire.
//
// Servi dans une IFRAME sur un site tiers dont on ne connaît pas la pile technique. D'où trois
// contraintes qui expliquent la forme de cette page :
//   • AUCUN CHROME — elle vit hors du groupe (app), dont le layout porte la navigation. Le
//     layout racine n'a ni en-tête ni menu : rien à désactiver, il suffit d'être ici.
//   • AUCUNE AUTHENTIFICATION — le produit n'a pas de middleware, chaque route appelle `auth()`
//     si elle en a besoin. Celle-ci ne le fait pas : elle est publique par construction.
//   • VISUELLEMENT NEUTRE — gris, une seule couleur d'accent, aucun aplat de marque. Le module
//     doit pouvoir atterrir sur n'importe quelle charte sans jurer.
//
// Non indexée : son contenu duplique la page de propagande, qui est la version canonique.

// Le registre des instances a été SORTI D'ICI le 20/08 vers `src/lib/embedTerritoire.ts`.
// Il y était bien formé — ajouter une zone = ajouter une entrée — mais visible de cette page
// seule : `/admin/diffusion` codait la sienne à la main, et une deuxième CPTS aurait donc
// fonctionné côté module tout en restant invisible côté administration.
//
// La profession reste déclarée par instance, jamais figée dans le rendu (exigence du 13/08) :
// elle sert à DEUX choses qui doivent rester d'accord — le filtre des annonces et le titre
// affiché. Le titre disait « Postes de kinésithérapie » en dur pendant que la requête ne
// filtrait sur aucune profession ; un non-kiné y serait apparu sous un titre qui le contredit.
const ZONES = EMBED_PAR_SLUG;

export async function generateMetadata(
  { params }: { params: Promise<{ zone: string }> },
): Promise<Metadata> {
  const { zone } = await params;
  const cfg = ZONES[zone];
  return {
    title: cfg ? `Postes ouverts — ${ZONE_LABELS[cfg.zone]} | Soignect` : "Soignect",
    robots: { index: false, follow: false },
  };
}

export default async function EmbedTerritoirePage(
  { params }: { params: Promise<{ zone: string }> },
) {
  const { zone } = await params;
  const cfg = ZONES[zone];
  if (!cfg) notFound();

  // Communes de la zone — mêmes libellés que `location`, pour rattraper les annonces
  // antérieures aux macro-zones (voir lib/annoncesTerritoire).
  const communes = Object.entries(COMMUNE_ZONE)
    .filter(([, z]) => z === cfg.zone)
    .map(([commune]) => commune);

  const [priorites, aplDuTerritoire] = await Promise.all([
    cfg.clientNom ? zonesPrioritairesDuClient(cfg.clientNom) : Promise.resolve([]),
    // Millésime de l'APL du territoire : les priorités en sont tirées (20/10), et le module le
    // dit. NULL tant qu'aucun import daté n'est passé — alors il ne cite rien.
    prisma.communeAPL.aggregate({
      where: { codeInsee: { in: communes.map(inseeOfCommune).filter((c): c is string => !!c) } },
      _max: { aplAnnee: true },
    }),
  ]);

  // Le rendu est celui de la page hébergée d'un client (/p/{jeton}) : un seul composant, pour
  // que le module et la page ne divergent jamais (20/10).
  return (
    <>
      {/* Le <body> de l'application porte `background-color: var(--md-background)` (globals.css).
          Dans une iframe plus haute que le contenu, cette couleur déborde et dessine une bande
          étrangère sur le site hôte — constaté à l'écran. Un module embarquable ne doit imposer
          AUCUN fond : on le rend transparent pour que celui de l'hôte passe au travers, quel
          qu'il soit, clair ou sombre. */}
      <style>{`body { background: transparent !important; }`}</style>
      <div className="p-4 text-[#1f2937]" style={{ fontSize: 14 }}>
        <PostesDuTerritoire
          zones={[cfg.zone]}
          communes={communes}
          professions={cfg.professions}
          priorites={priorites}
          destinataire={cfg.destinataire}
          territoire={ZONE_LABELS[cfg.zone]}
          trace={cleTraceEmbed(cfg)}
          anneeApl={aplDuTerritoire._max.aplAnnee}
        />
      </div>
    </>
  );
}
