import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { filtreAnnoncesVivantes } from "@/lib/annoncesTerritoire";
import { EMBED_PAR_SLUG } from "@/lib/embedTerritoire";
import { COMMUNE_ZONE, ZONE_LABELS } from "@/lib/communes";
import { tracerVueLanding } from "@/lib/traceLanding";

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

  const missions = await prisma.mission.findMany({
    where: // Le module montre les POSTES d'un territoire à des candidats : camp EMPLOYEUR.
    filtreAnnoncesVivantes([cfg.zone], communes, cfg.profession.enumBase, "EMPLOYEUR"),
    include: { profile: { select: { type: true, name: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    take: 10,
  });

  await tracerVueLanding(`embed-${zone}`, missions.length);

  const jour = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

  const TYPE: Record<string, string> = {
    REMPLACEMENT: "Remplacement",
    ASSISTANAT: "Assistanat",
    COLLABORATION: "Collaboration",
  };

  return (
    <>
      {/* Le <body> de l'application porte `background-color: var(--md-background)` (globals.css).
          Dans une iframe plus haute que le contenu, cette couleur déborde et dessine une bande
          étrangère sur le site hôte — constaté à l'écran. Un module embarquable ne doit imposer
          AUCUN fond : on le rend transparent pour que celui de l'hôte passe au travers, quel
          qu'il soit, clair ou sombre. */}
      <style>{`body { background: transparent !important; }`}</style>
      <div className="p-4 text-[#1f2937]" style={{ fontSize: 14 }}>
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-base font-bold m-0">
          Postes de {cfg.profession.discipline} — {ZONE_LABELS[cfg.zone]}
        </h2>
        <span className="text-xs text-gray-400">
          {missions.length} poste{missions.length > 1 ? "s" : ""} ouvert{missions.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* ── EMPLACEMENT RÉSERVÉ — indicateur de tension du territoire (v2) ──────────────
          À construire quand l'investigation commune ↔ zone sera revenue. Elle doit dire de
          quelle DONNÉE il s'agit : le zonage ARS (arrêté 971-2024, 2 catégories seulement en
          Guadeloupe) est un classement réglementaire régional, l'APL de la DREES est une donnée
          nationale brute — deux couches distinctes, à ne pas mélanger dans un même indicateur.
          Ne rien afficher tant que la source n'est pas tranchée : un indicateur de tension faux
          sur le site d'une CPTS coûterait plus cher que son absence. */}

      {missions.length === 0 ? (
        <p className="text-sm text-gray-500 m-0">
          Aucun poste ouvert sur le territoire pour le moment.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 space-y-2">
          {missions.map((m) => {
            const periode =
              m.startDate && m.endDate ? `${jour(m.startDate)} → ${jour(m.endDate)}`
              : m.startDate ? `dès le ${jour(m.startDate)}`
              : m.minMonths ? `${m.minMonths} mois min.`
              : null;
            return (
              <li key={m.id} className="border border-gray-200 rounded-lg px-3 py-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    {TYPE[m.missionType] ?? m.missionType}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {m.location}{periode ? ` · ${periode}` : ""}
                  </span>
                </div>
                <p className="text-sm font-semibold m-0 mt-0.5">{m.title}</p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Le lien s'ouvre HORS de l'iframe : enfermer un parcours d'inscription dans un cadre de
          quelques centaines de pixels, sur un site tiers, ne mènerait nulle part. */}
      <a
        href={cfg.page}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block w-full text-center px-4 py-2.5 rounded-lg bg-[#0B3D5C] text-white text-sm font-semibold no-underline"
      >
        Voir tous les postes et publier une annonce →
      </a>
      <p className="text-[11px] text-gray-400 text-center mt-2 mb-0">
        Propulsé par Soignect · gratuit pour les professionnels en recherche
      </p>
      </div>
    </>
  );
}
