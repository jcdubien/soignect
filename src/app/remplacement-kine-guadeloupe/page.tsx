import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Remplacement kiné Guadeloupe — Annonces & disponibilités | ParaBoard",
  description:
    "Trouvez un remplacement en kinésithérapie en Guadeloupe. Annonces de cabinets et remplaçants kinés disponibles sur toute la Guadeloupe (Grande-Terre, Basse-Terre, Marie-Galante, Les Saintes, La Désirade).",
  openGraph: {
    title: "Remplacement kiné Guadeloupe | ParaBoard",
    description: "Le job board des kinésithérapeutes de Guadeloupe. Trouvez un remplaçant ou un cabinet en quelques swipes.",
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

async function getMissions() {
  return prisma.mission.findMany({
    where: {
      isActive: true,
      location: { in: GUADELOUPE_COMMUNES },
    },
    include: { profile: { select: { type: true, name: true, ratingAvg: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    take: 20,
  });
}

export default async function GuadeloupePage() {
  const missions = await getMissions();

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 Guadeloupe
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">
          Remplacement kiné Guadeloupe
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          ParaBoard est le job board Tinder des kinésithérapeutes de Guadeloupe.
          Cabinets et remplaçants se trouvent en quelques swipes — sans intermédiaire,
          sans frais pour les remplaçants.
        </p>
      </div>

      {/* CTA inscription */}
      <div className="bg-gradient-to-br from-kine-600 to-kine-800 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">Rejoignez ParaBoard gratuitement</p>
          <p className="text-kine-100 text-sm">Remplaçants : accès à vie, sans aucun frais. Cabinets : première annonce gratuite.</p>
        </div>
        <Link
          href="/register"
          className="flex-shrink-0 px-5 py-3 bg-white text-kine-700 rounded-xl font-bold text-sm hover:bg-kine-50 transition"
        >
          S&apos;inscrire →
        </Link>
      </div>

      {/* Liste des annonces */}
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        {missions.length > 0
          ? `${missions.length} annonce${missions.length > 1 ? "s" : ""} en Guadeloupe`
          : "Aucune annonce pour le moment"}
      </h2>

      {missions.length > 0 && (
        <div className="space-y-3">
          {missions.map((m) => {
            const dateRange = m.startDate && m.endDate
              ? `${formatDate(m.startDate)} → ${formatDate(m.endDate)}`
              : m.minMonths ? `${m.minMonths} mois min.` : null;

            const typeLabel = { REMPLACANT: "Remplaçant", ASSISTANT: "Assistant", TITULAIRE: "Cabinet" }[m.profile.type];

            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        m.profile.type === "TITULAIRE" ? "bg-emerald-100 text-emerald-700" :
                        m.profile.type === "ASSISTANT" ? "bg-violet-100 text-violet-700" :
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
        <p className="text-gray-400 text-sm mb-3">Voir toutes les annonces et swiper</p>
        <Link
          href="/register"
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
          toute l&apos;année, avec des pics en juillet-août et en décembre.
        </p>
        <p>
          Le taux de rétrocession moyen en Guadeloupe se situe entre 65% et 80%.
          Les communes de zone intermédiaire (Bouillante, Deshaies, Capesterre-Belle-Eau, Sainte-Rose…)
          peuvent offrir des perspectives d&apos;installation aidées par l&apos;ARS.
        </p>
        <p>
          ParaBoard référence les annonces de remplacement sur l&apos;ensemble du territoire guadeloupéen,
          des cabinets de Pointe-à-Pitre aux structures rurales de Marie-Galante.
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
