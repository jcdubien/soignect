import { Metadata } from "next";
import { KINESITHERAPEUTE, TERRITOIRES, titrePage } from "@/lib/pagesDiffusion";
import { prisma } from "@/lib/prisma";
import { filtreAnnoncesVivantes } from "@/lib/annoncesTerritoire";
import Link from "next/link";
import type { ZoneGeographique } from "@prisma/client";
import { libelleTypePoste, estEtablissement } from "@/lib/libellesPoste";
import { tracerVueLanding } from "@/lib/traceLanding";

export const dynamic = "force-dynamic";

// Textes portés par lib/pagesDiffusion : {profession × territoire}, plus dupliqués ici.
const PRO = KINESITHERAPEUTE;
const TERR = TERRITOIRES.GUADELOUPE;

export const metadata: Metadata = {
  alternates: { canonical: "/remplacement-kine-guadeloupe" },
  // Le titre garde « remplacement kiné Guadeloupe » en tête — c'est la requête réellement
  // tapée — mais nomme aussi l'assistanat et la collaboration, que la page montrait déjà sans
  // jamais les annoncer.
  title: TERR.metaTitre(PRO),
  description: TERR.metaDescription(PRO),
  openGraph: {
    url: "/remplacement-kine-guadeloupe",
    title: TERR.ogTitre(PRO),
    description: TERR.ogDescription(PRO),
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
  // Filtre partagé avec le module embarquable (lib/annoncesTerritoire) : il porte les deux
  // corrections apprises ici — macro-zones ET communes acceptées, expiration écrite en positif.
  return prisma.mission.findMany({
    where: filtreAnnoncesVivantes(GUADELOUPE_ZONES, GUADELOUPE_COMMUNES, PRO.enumBase),
    include: { profile: { select: { type: true, titulaireKind: true, name: true, ratingAvg: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    take: 20,
  });
}

export default async function GuadeloupePage() {
  const missions = await getMissions();

  // Trace de fréquentation (section 86) — mécanique partagée par les trois pages d'entrée.
  await tracerVueLanding("remplacement-kine-guadeloupe", missions.length);

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 {TERR.nom}
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">
          {titrePage(PRO, TERR)}
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          {TERR.accroche(PRO)}
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

            // Le badge dit ce qui est PROPOSÉ, pas seulement qui publie — et dans le
            // vocabulaire de celui qui publie : un CDI d'établissement s'affichait
            // « Collaboration libérale ». Table unique dans lib/libellesPoste.
            const typeLabel = libelleTypePoste(m.missionType, m.profile);
            const estEtab = estEtablissement(m.profile);

            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        estEtab ? "bg-slate-100 text-slate-700" :
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
        {/* NE GARDER ICI QUE CE QUI EST VRAI PAR CONSTRUCTION (10/08). Ce bas de page portait
            des affirmations de marché écrites pour le référencement, sans source : taux de
            rétrocession, dispositifs ARS, nombre de cabinets, saisonnalité, niveaux de
            rémunération. L'une d'elles s'est révélée fausse. Sur une page qui s'adresse à des
            professionnels décidant d'un contrat, une affirmation invérifiable coûte plus en
            crédibilité qu'elle ne rapporte en référencement.
            Ne subsistent que des faits vérifiables dans le code lui-même : les territoires
            couverts, les types de poste, et ce que fait Soignect. */}
        <h2 className="text-base font-semibold text-gray-600">Kinésithérapie en Guadeloupe — ce que couvre Soignect</h2>
        <p>
          Soignect référence les postes de kinésithérapie sur l&apos;ensemble du territoire
          guadeloupéen — remplacements ponctuels, assistanats et collaborations libérales — sur
          Grande-Terre, Basse-Terre, Marie-Galante, les Saintes et la Désirade.
        </p>
        <p>
          Les postes affichés ci-dessus sont publiés par les cabinets et les kinésithérapeutes
          eux-mêmes. La liste est celle du moment : les périodes déjà terminées n&apos;y figurent
          pas. L&apos;inscription est gratuite pour qui cherche un poste.
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
