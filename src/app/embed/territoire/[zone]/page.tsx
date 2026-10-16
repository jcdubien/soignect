import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { filtreAnnoncesVivantes } from "@/lib/annoncesTerritoire";
import { EMBED_PAR_SLUG, cleTraceEmbed } from "@/lib/embedTerritoire";
import { libelleTypePoste } from "@/lib/libellesPoste";
import { libelleProfession, VOCABULAIRE_PROFESSION } from "@/lib/pagesDiffusion";
import { zonesPrioritairesDuClient } from "@/lib/territoire";
import PostesEmbed, { type PosteEmbed } from "./PostesEmbed";
import { COMMUNE_ZONE, ZONE_LABELS, inseeOfCommune } from "@/lib/communes";
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

  // Toutes les offres vivantes du territoire, sans plafond à la requête : le plafond de 10
  // coupait au hasard du tri, et pouvait écarter justement un poste de zone prioritaire. Les
  // volumes d'un territoire restent faibles ; le plafond s'applique plus bas, aux AUTRES postes.
  const [missions, zonesDeclarees] = await Promise.all([
    prisma.mission.findMany({
      where: // Le module montre les POSTES d'un territoire à des candidats : camp EMPLOYEUR.
      filtreAnnoncesVivantes([cfg.zone], communes, cfg.professions.map((p) => p.enumBase), "EMPLOYEUR"),
      include: { profile: { select: { type: true, name: true, titulaireKind: true, profession: true } } },
      orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
      take: 100,
    }),
    cfg.clientNom ? zonesPrioritairesDuClient(cfg.clientNom) : Promise.resolve([]),
  ]);

  await tracerVueLanding(cleTraceEmbed(cfg), missions.length);

  // ZONES PRIORITAIRES D'ABORD (15/10). Une CPTS qui héberge ce module ne gagne rien à une liste
  // de postes à plat : ce qu'elle veut, c'est répartir les soignants vers les communes où elle a
  // déclaré un manque. Ses déclarations (`PrioriteTerritoriale`, les mêmes que celles qui
  // remontent ces annonces dans le fil) ouvrent donc le module, avec leurs postes — et une
  // commune prioritaire SANS poste reste affichée : c'est le message de la CPTS, qu'un poste
  // soit publié ou non.
  const professionsModule = new Set(cfg.professions.map((p) => p.enumBase));
  const zonesPrio = zonesDeclarees.filter((z) => professionsModule.has(z.profession));
  const zoneDe = (m: (typeof missions)[number]) =>
    zonesPrio.find((z) => z.codeInsee === inseeOfCommune(m.location) && z.profession === m.profile.profession);
  const postesPrio = missions.filter((m) => zoneDe(m));
  const autres = missions.filter((m) => !zoneDe(m)).slice(0, 10);

  const jour = (d: Date | null) =>
    // Les dates sont stockées à 00:00 UTC : formatées à l'heure locale du serveur (Guadeloupe,
    // UTC−4), elles reculaient d'un jour — « 27 déc. » pour une annonce du 28/12.
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }) : null;

  // Une seule profession déclarée : le titre la nomme. Plusieurs : « Postes de santé », et
  // chaque ligne porte sa profession.
  const uneSeule = cfg.professions.length === 1 ? cfg.professions[0] : null;
  const inscription = `/register?src=${cleTraceEmbed(cfg)}`;

  // Ce que la fiche montre est ce que la page publique montre SANS compte — rien de plus.
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const aujourdhui = iso(new Date());
  const versPoste = (m: (typeof missions)[number], prioritaire: boolean): PosteEmbed => {
    const accroche = (m.pitch ?? m.bioTinder ?? "").trim();
    return {
      id: m.id,
      titre: m.title,
      libelle: libelleTypePoste(m.missionType, m.profile, m.natureSalariat)
        + (!uneSeule && m.profile.profession ? ` · ${libelleProfession(m.profile.profession)}` : ""),
      lieu: m.location,
      periode:
        m.startDate && m.endDate ? `${jour(m.startDate)} → ${jour(m.endDate)}`
        : m.startDate ? `dès le ${jour(m.startDate)}`
        : m.minMonths ? `${m.minMonths} mois min.`
        : null,
      // Une disponibilité ne peut pas commencer dans le passé (section 250) : un poste déjà
      // commencé propose ses jours restants.
      debut: m.startDate && m.endDate ? (iso(m.startDate) < aujourdhui ? aujourdhui : iso(m.startDate)) : null,
      fin: m.startDate && m.endDate ? iso(m.endDate) : null,
      remuneration:
        m.remunerationBrute != null ? `${m.remunerationBrute.toLocaleString("fr-FR")} €/mois brut`
        : m.caMensuelEstime != null ? `CA estimé ~ ${m.caMensuelEstime.toLocaleString("fr-FR")} €/mois`
        : null,
      accroche: accroche ? (accroche.length > 120 ? accroche.slice(0, 120).trimEnd() + "…" : accroche) : null,
      prioritaire,
    };
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
          Postes {uneSeule ? `de ${uneSeule.discipline}` : "de santé"} — {ZONE_LABELS[cfg.zone]}
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

      {zonesPrio.length > 0 && (
        <section className="rounded-xl bg-[#0B3D5C]/[0.06] border border-[#0B3D5C]/20 p-3 mb-4">
          <p className="text-sm font-bold m-0 text-[#0B3D5C]">
            Zones prioritaires de la {cfg.destinataire}
          </p>
          <p className="text-xs text-gray-600 m-0 mt-0.5 mb-2">
            La {cfg.destinataire} y recherche en priorité des professionnels de santé.
          </p>
          <ul className="list-none p-0 m-0 mb-2 space-y-1">
            {zonesPrio.map((z) => {
              const n = postesPrio.filter((m) => zoneDe(m) === z).length;
              return (
                <li key={`${z.codeInsee}-${z.profession}`} className="text-sm flex items-baseline justify-between gap-2 flex-wrap">
                  <span>
                    <strong>{z.commune}</strong>
                    <span className="text-gray-500"> · {VOCABULAIRE_PROFESSION[z.profession]?.courtPluriel ?? libelleProfession(z.profession)}</span>
                  </span>
                  {n > 0 ? (
                    <span className="text-xs font-semibold text-[#0B3D5C]">
                      {n} poste{n > 1 ? "s" : ""} ouvert{n > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <a href={inscription} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#0B3D5C] underline">
                      Aucun poste publié — proposez-vous →
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          {postesPrio.length > 0 && (
            <PostesEmbed postes={postesPrio.map((m) => versPoste(m, true))} src={cleTraceEmbed(cfg)} />
          )}
        </section>
      )}

      {missions.length === 0 ? (
        <p className="text-sm text-gray-500 m-0">
          Aucun poste ouvert sur le territoire pour le moment.
        </p>
      ) : autres.length > 0 && (
        <>
          {zonesPrio.length > 0 && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide m-0 mb-2">
              Autres postes du territoire
            </p>
          )}
          <PostesEmbed postes={autres.map((m) => versPoste(m, false))} src={cleTraceEmbed(cfg)} />
        </>
      )}

      {/* Le lien s'ouvre HORS de l'iframe : enfermer un parcours d'inscription dans un cadre de
          quelques centaines de pixels, sur un site tiers, ne mènerait nulle part. */}
      <a
        href={inscription}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block w-full text-center px-4 py-2.5 rounded-lg bg-[#0B3D5C] text-white text-sm font-semibold no-underline"
      >
        Créer mon compte gratuit →
      </a>
      <p className="text-[11px] text-gray-400 text-center mt-2 mb-0">
        Propulsé par Soignect · gratuit pour les professionnels en recherche
      </p>
      </div>
    </>
  );
}
