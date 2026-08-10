import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { ZoneGeographique } from "@prisma/client";
import { headers } from "next/headers";
import { logTraceEvent } from "@/lib/trace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Le titre garde « remplacement kiné Guadeloupe » en tête — c'est la requête réellement
  // tapée — mais nomme aussi l'assistanat et la collaboration, que la page montrait déjà sans
  // jamais les annoncer.
  title: "Remplacement, assistanat, collaboration kiné en Guadeloupe | Soignect",
  description:
    "Postes de kinésithérapie en Guadeloupe : remplacements ponctuels, assistanats et collaborations libérales. Annonces de cabinets et kinés disponibles sur toute la Guadeloupe (Grande-Terre, Basse-Terre, Marie-Galante, Les Saintes, La Désirade).",
  openGraph: {
    title: "Postes de kiné en Guadeloupe | Soignect",
    description: "Le job board des kinésithérapeutes de Guadeloupe : remplacement, assistanat, collaboration. Trouvez un cabinet ou un candidat en quelques swipes.",
    type: "website",
  },
};

const GUADELOUPE_COMMUNES = [
  "Pointe-à-Pitre", "Les Abymes", "Baie-Mahault", "Le Gosier", "Sainte-Anne",
  "Saint-François", "Le Moule", "Morne-à-l'Eau", "Anse-Bertrand", "Port-Louis",
  "Petit-Canal", "Basse-Terre", "Gourbeyre", "Baillif", "Saint-Claude", "Vieux-Fort",
  "Capesterre-Belle-Eau", "Trois-Rivières", "Vieux-Habitants", "Bouillante",
  "Pointe-Noire", "Deshaies", "Sainte-Rose", "Lamentin", "Petit-Bourg", "Goyave",
  "Grand-Bourg (Marie-Galante)", "Capesterre-de-Marie-Galante", "Saint-Louis (Marie-Galante)",
  "La Désirade", "Terre-de-Haut (Les Saintes)", "Terre-de-Bas (Les Saintes)",
];

// Les huit zones guadeloupéennes. Saint-Martin et Saint-Barthélemy en sont volontairement
// absentes : elles ont leurs propres pages d'entrée.
const GUADELOUPE_ZONES: ZoneGeographique[] = [
  "CENTRE_CAP_EXCELLENCE", "SUD_GRANDE_TERRE", "NORD_GRANDE_TERRE", "SUD_BASSE_TERRE",
  "NORD_BASSE_TERRE", "MARIE_GALANTE", "LES_SAINTES", "LA_DESIRADE",
];

async function getMissions() {
  const maintenant = new Date();
  return prisma.mission.findMany({
    where: {
      isActive: true,
      AND: [
        // Le produit est passé aux MACRO-ZONES (section 138), la page était restée sur une
        // liste figée de communes comparée au champ libre `location`. Elle écartait donc en
        // silence tout ce qui n'était pas une commune exacte — 3 annonces actives sur 10, dont
        // les DEUX SEULES disponibilités de remplaçants, qui portaient « Sud Basse-Terre » ou
        // une liste de zones. La page ne montrait que des cabinets.
        // Les communes restent acceptées : les annonces antérieures aux zones n'en ont pas.
        { OR: [{ zones: { hasSome: GUADELOUPE_ZONES } }, { location: { in: GUADELOUPE_COMMUNES } }] },
        // Une annonce terminée n'est pas une preuve d'activité, c'est le contraire. Pas de date
        // de fin = annonce ouverte (« dès septembre »), surtout pas périmée : il faut l'écrire
        // explicitement, car en SQL `NOT (null < maintenant)` ne vaut pas vrai et les faisait
        // toutes disparaître — 3 des 9 lors du test.
        { OR: [{ endDate: null }, { endDate: { gte: maintenant } }] },
      ],
    },
    include: { profile: { select: { type: true, name: true, ratingAvg: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    take: 20,
  });
}

// Robots connus. On ne les EXCLUT pas — savoir qu'on est indexé a de la valeur — on les
// ÉTIQUETTE, pour que le comptage humain reste lisible. Sans ça, un passage de Googlebot et une
// visite réelle pèsent pareil, et le chiffre ne veut plus rien dire.
const ROBOTS = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python-requests/i;

export default async function GuadeloupePage() {
  const missions = await getMissions();

  // Trace de fréquentation (section 86). Cette page n'en posait AUCUNE : il n'existait, avant
  // ce jour, aucun moyen de savoir si elle recevait du trafic — ni compteur d'audience installé
  // dans le projet, ni événement ici. On relançait donc une campagne à l'aveugle, sans pouvoir
  // dire un mois plus tard si elle avait converti.
  //
  // Le référent et la campagne sont conservés parce que c'est EUX la question : distinguer une
  // arrivée depuis Facebook d'une arrivée par recherche organique. Aucune donnée personnelle —
  // ni IP, ni identifiant : on compte des provenances, pas des personnes.
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    const referent = h.get("referer");
    logTraceEvent({
      eventType: "LANDING_VIEW",
      metadata: {
        page: "remplacement-kine-guadeloupe",
        robot: ROBOTS.test(ua),
        // Domaine référent seul, jamais l'URL complète : elle peut porter des paramètres privés.
        referent: referent ? (() => { try { return new URL(referent).hostname; } catch { return "invalide"; } })() : null,
        annonces: missions.length,
      },
    });
  } catch {
    // Une trace ne doit jamais empêcher la page de s'afficher.
  }

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 Guadeloupe
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">
          Kiné en Guadeloupe : remplacement, assistanat, collaboration
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          Soignect est le job board Tinder des kinésithérapeutes de Guadeloupe.
          Une mission de quelques semaines, un assistanat sur la durée ou une collaboration
          libérale : cabinets et candidats se trouvent en quelques swipes, sans intermédiaire.
          Gratuit pour qui cherche un poste.
        </p>
      </div>

      {/* CTA inscription */}
      <div className="bg-gradient-to-br from-kine-600 to-kine-800 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">Rejoignez Soignect gratuitement</p>
          {/* Promesse volontairement NON CHIFFRÉE. L'ancienne — « Cabinets : première annonce
              gratuite » — était fausse : la bascule payante d'un cabinet se déclenche à sa
              première signature de contrat, pas à sa deuxième annonce, et il peut en publier
              autant qu'il veut sans rien payer. On n'annonce donc plus de seuil pour les
              cabinets. Ce qui reste affirmé est vrai sans condition ni date : triggerBillingIfNeeded
              ne s'applique qu'au type TITULAIRE, un chercheur de poste n'est jamais facturé. */}
          <p className="text-kine-100 text-sm">
            Remplacement, assistanat, collaboration : la recherche de poste est gratuite, sans frais ni engagement.
          </p>
        </div>
        <Link
          href="/register?profileType=REMPLACANT&src=gp-landing"
          className="flex-shrink-0 px-5 py-3 bg-white text-kine-700 rounded-xl font-bold text-sm hover:bg-kine-50 transition"
        >
          S&apos;inscrire →
        </Link>
      </div>

      {/* Liste des annonces */}
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        {missions.length > 0
          ? `${missions.length} poste${missions.length > 1 ? "s" : ""} en Guadeloupe`
          : "Aucune annonce pour le moment"}
      </h2>

      {missions.length > 0 && (
        <div className="space-y-3">
          {missions.map((m) => {
            const dateRange = m.startDate && m.endDate
              ? `${formatDate(m.startDate)} → ${formatDate(m.endDate)}`
              : m.minMonths ? `${m.minMonths} mois min.` : null;

            // Le badge disait seulement QUI publie (« Cabinet »), jamais CE QUI est proposé :
            // un assistanat de 12 mois et un remplacement de trois semaines s'affichaient à
            // l'identique. Même cadrage que la carte de partage — un cabinet PROPOSE, un
            // candidat SE PROPOSE.
            const estCandidat = m.profile.type === "REMPLACANT" || m.profile.type === "ASSISTANT";
            const typeLabel = estCandidat
              ? { REMPLACEMENT: "Remplaçant disponible", ASSISTANAT: "Cherche un assistanat", COLLABORATION: "Cherche une collaboration" }[m.missionType]
              : { REMPLACEMENT: "Remplacement", ASSISTANAT: "Assistanat · long terme", COLLABORATION: "Collaboration libérale" }[m.missionType];

            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        m.missionType === "ASSISTANAT" ? "bg-violet-100 text-violet-700" :
                        m.missionType === "COLLABORATION" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{typeLabel}</span>
                      {m.profile.ratingAvg && (
                        <span className="text-xs text-yellow-600 font-semibold">★ {m.profile.ratingAvg.toFixed(1)}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm leading-snug">{m.title}</h3>
                    <p className="text-gray-400 text-xs mt-1">📍 {m.location}{dateRange ? ` · ${dateRange}` : ""}</p>
                  </div>
                </div>
                {m.pitch && (
                  <p className="text-gray-500 text-xs mt-2 italic border-l-2 border-kine-300 pl-2 line-clamp-2">{m.pitch}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-gray-400 text-sm mb-3">Voir toutes les annonces disponibles</p>
        <Link
          href="/register?profileType=REMPLACANT&src=gp-landing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 transition"
        >
          Créer mon compte gratuitement →
        </Link>
      </div>

      {/* SEO content */}
      <div className="mt-12 border-t border-gray-100 pt-8 space-y-4 text-sm text-gray-400">
        <h2 className="text-base font-semibold text-gray-600">Remplacement kiné en Guadeloupe — tout savoir</h2>
        <p>
          La Guadeloupe compte plus de 300 cabinets de kinésithérapie répartis sur Grande-Terre,
          Basse-Terre, Marie-Galante, les Saintes et la Désirade. Le marché du remplacement y est actif
          toute l&apos;année, avec des pics en juillet-août et en décembre. Les postes durables —
          assistanat et collaboration libérale — s&apos;y négocient au fil de l&apos;eau, et les
          cabinets peinent souvent à les pourvoir.
        </p>
        {/* Un paragraphe se trouvait ici : « taux de rétrocession moyen entre 65 % et 80 % » et
            « perspectives d'installation aidées par l'ARS » dans les communes de zone
            intermédiaire. RETIRÉ le 10/08 — Jean-Charles le signale comme FAUX. Il énonçait des
            chiffres de marché et un dispositif d'aide publique sans source, sur une page de
            campagne : sur ce terrain une approximation n'est pas une maladresse de rédaction,
            c'est une information erronée donnée à des professionnels qui décident. Ne pas
            réintroduire de chiffre de rétrocession ni de mention de dispositif ARS sans source
            vérifiable. */}
        <p>
          Soignect référence les postes de kinésithérapie sur l&apos;ensemble du territoire guadeloupéen —
          remplacements ponctuels, assistanats et collaborations — des cabinets de Pointe-à-Pitre aux
          structures rurales de Marie-Galante.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/remplacement-kine-saint-martin" className="underline hover:text-kine-600">Remplacement kiné Saint-Martin</Link>
          <span>·</span>
          <Link href="/remplacement-kine-saint-barth" className="underline hover:text-kine-600">Remplacement kiné Saint-Barth</Link>
        </div>
      </div>
    </div>
  );
}
