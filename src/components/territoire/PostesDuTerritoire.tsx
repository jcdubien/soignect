import type { Profession, ZoneGeographique } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtreAnnoncesVivantes } from "@/lib/annoncesTerritoire";
import { libelleTypePoste } from "@/lib/libellesPoste";
import { VOCABULAIRE_PROFESSION } from "@/lib/pagesDiffusion";
import { PROFESSION_LABELS, PROFESSION_PLURIEL } from "@/lib/professions";
import { inseeOfCommune, libelleCommune } from "@/lib/communes";
import { periodePoste } from "@/lib/datesPoste";
import { libelleAcces } from "@/lib/aplPalier";
import type { ZonePrioritaire } from "@/lib/territoire";
import { tracerVueLanding } from "@/lib/traceLanding";
import PostesEmbed, { type PosteEmbed } from "@/app/embed/territoire/[zone]/PostesEmbed";

// Les postes d'un territoire, zones prioritaires en tête (20/10).
//
// Extrait du module embarquable (section 208) pour servir AUSSI la page hébergée d'un client
// (/p/{jeton}) : un seul rendu, deux portes. Le module dépend du webmaster qui l'intègre, la
// page d'un lien que le client diffuse lui-même — ce qu'ils montrent ne doit pas diverger.
//
// Le composant fait sa propre requête et sa propre trace : l'appelant ne fournit que le
// périmètre (zones, communes, professions), les priorités déjà filtrées, et ses mots.

export interface PropsPostesDuTerritoire {
  zones: ZoneGeographique[];
  /** Libellés produit (`Mission.location`). */
  communes: string[];
  professions: Profession[];
  priorites: ZonePrioritaire[];
  destinataire: string;
  /** Titre du bloc, ex. « Nord Basse-Terre ». */
  territoire: string;
  /** Clé de trace (LANDING_VIEW) et paramètre `src` des liens. */
  trace: string;
  anneeApl: number | null;
  /** false = page de démonstration : les priorités viennent de l'APL seul, et le bloc ne les
   *  attribue PAS au client, qui n'a rien déclaré (même règle que « par sa CPTS », retiré le
   *  18/08 : on n'attribue à une institution que ce qu'elle a posé). */
  attribuee?: boolean;
}

export default async function PostesDuTerritoire({
  zones, communes, professions, priorites, destinataire, territoire, trace, anneeApl, attribuee = true,
}: PropsPostesDuTerritoire) {
  // Toutes les offres vivantes du périmètre, sans plafond à la requête : le plafond de 10
  // coupait au hasard du tri, et pouvait écarter justement un poste de zone prioritaire. Les
  // volumes d'un territoire restent faibles ; le plafond s'applique plus bas, aux AUTRES postes.
  const missions = await prisma.mission.findMany({
    // Des POSTES montrés à des candidats : camp EMPLOYEUR.
    where: filtreAnnoncesVivantes(zones, communes, professions, "EMPLOYEUR"),
    include: { profile: { select: { type: true, name: true, titulaireKind: true, profession: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    take: 100,
  });
  await tracerVueLanding(trace, missions.length);

  // ZONES PRIORITAIRES D'ABORD (15/10). Un client qui diffuse ces postes veut répartir les
  // soignants vers les communes où l'accès aux soins manque ; une commune prioritaire SANS
  // poste reste affichée : c'est son message, qu'un poste soit publié ou non.
  const dansLeModule = new Set<string>(professions);
  const zonesPrio = priorites.filter((z) => dansLeModule.has(z.profession));
  const zoneDe = (m: (typeof missions)[number]) =>
    zonesPrio.find((z) => z.codeInsee === inseeOfCommune(m.location) && z.profession === m.profile.profession);
  const postesPrio = missions.filter((m) => zoneDe(m));
  const autres = missions.filter((m) => !zoneDe(m)).slice(0, 10);
  // Une ligne PAR COMMUNE, ses professions à la suite (20/10) : avec une priorité par
  // profession, une commune occupait jusqu'à quatre lignes. L'ordre est celui reçu (niveau le
  // plus haut d'abord).
  const communesPrio = Array.from(new Set(zonesPrio.map((z) => z.codeInsee))).map((code) => {
    const zs = zonesPrio.filter((z) => z.codeInsee === code);
    return { codeInsee: code, commune: zs[0].commune, zs };
  });

  // Ce que le compteur annonce est ce que la page MONTRE (20/10) : il comptait toutes les offres
  // du périmètre, y compris celles coupées par le plafond des « autres postes ».
  const visibles = postesPrio.length + autres.length;

  // Se proposer, profession par profession (20/10) : un lien vers l'inscription avec SA
  // profession préselectionnée. Une profession que Soignect n'ouvre pas encore (pas de
  // vocabulaire déclaré : médecins, sages-femmes) n'a pas de lien d'inscription — l'y envoyer
  // serait l'inscrire dans un marché vide. Pas de page d'intérêt à ce jour : « Bientôt » seul.
  const lienProfession = (p: Profession) =>
    VOCABULAIRE_PROFESSION[p] ? `/register?profession=${p}&src=${trace}` : null;

  // Une seule profession déclarée : le titre la nomme. Plusieurs : « Postes de santé », et
  // chaque ligne porte sa profession.
  const uneSeule = professions.length === 1 ? VOCABULAIRE_PROFESSION[professions[0]] ?? null : null;
  const inscription = `/register?src=${trace}`;

  // Ce que la fiche montre est ce que la page publique montre SANS compte — rien de plus.
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const aujourdhui = iso(new Date());
  const versPoste = (m: (typeof missions)[number], prioritaire: boolean): PosteEmbed => {
    const accroche = (m.pitch ?? m.bioTinder ?? "").trim();
    return {
      id: m.id,
      titre: m.title,
      libelle: libelleTypePoste(m.missionType, m.profile, m.natureSalariat)
        + (!uneSeule && m.profile.profession ? ` · ${PROFESSION_LABELS[m.profile.profession]}` : ""),
      // Le titre reste tel que saisi ; la ligne de contexte, elle, porte le libellé canonique.
      lieu: libelleCommune(m.location),
      periode: periodePoste(m.startDate, m.endDate) ?? (m.minMonths ? `${m.minMonths} mois min.` : null),
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
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-base font-bold m-0">
          Postes {uneSeule ? `de ${uneSeule.discipline}` : "de santé"} — {territoire}
        </h2>
        <span className="text-xs text-gray-400">
          {visibles > 0 ? `${visibles} poste${visibles > 1 ? "s" : ""} dans le territoire` : ""}
        </span>
      </div>

      {zonesPrio.length > 0 && (
        <section className="rounded-xl bg-[#0B3D5C]/[0.06] border border-[#0B3D5C]/20 p-3 mb-4">
          <p className="text-sm font-bold m-0 text-[#0B3D5C]">
            {attribuee ? `Zones prioritaires — ${destinataire}` : "Là où l'accès aux soins est le plus faible"}
          </p>
          <p className="text-xs text-gray-600 m-0 mt-0.5 mb-2">
            {attribuee
              ? `${destinataire} y recherche en priorité ces professionnels, là où l'accès aux soins est le plus faible`
              : "Communes et professions les moins bien dotées du département"}
            {anneeApl ? ` (APL de la DREES, ${anneeApl})` : ""}.
          </p>
          <ul className="list-none p-0 m-0 mb-2 space-y-1.5">
            {communesPrio.map((c) => (
              <li key={c.codeInsee} className="text-sm">
                <strong>{c.commune}</strong>
                <ul className="list-none p-0 m-0 mt-0.5 space-y-0.5">
                  {c.zs.map((z) => {
                    const n = postesPrio.filter((m) => {
                      const zm = zoneDe(m);
                      return zm?.codeInsee === c.codeInsee && zm.profession === z.profession;
                    }).length;
                    const lien = lienProfession(z.profession);
                    return (
                      <li key={z.profession} className="flex items-baseline justify-between gap-2 flex-wrap pl-3">
                        <span className="text-gray-600">
                          {PROFESSION_PLURIEL[z.profession]}
                          <span className="text-[11px] text-gray-400"> ({libelleAcces(z.niveau)})</span>
                        </span>
                        {n > 0 ? (
                          <span className="text-xs font-semibold text-[#0B3D5C]">
                            {n} poste{n > 1 ? "s" : ""} ci-dessous
                          </span>
                        ) : lien ? (
                          <a href={lien} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#0B3D5C] underline">
                            Proposez-vous →
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Bientôt sur Soignect</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {postesPrio.length > 0 && (
            <PostesEmbed postes={postesPrio.map((m) => versPoste(m, true))} src={trace} />
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
          <PostesEmbed postes={autres.map((m) => versPoste(m, false))} src={trace} />
        </>
      )}

      {/* Le lien s'ouvre dans un nouvel onglet : dans le module, enfermer un parcours
          d'inscription dans un cadre de quelques centaines de pixels ne mènerait nulle part. */}
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
    </>
  );
}
