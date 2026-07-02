import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Remplacement kiné Saint-Barthélemy — Annonces & disponibilités | Soignect",
  description:
    "Trouvez un remplacement en kinésithérapie à Saint-Barthélemy. Annonces de cabinets et remplaçants kinés disponibles à Gustavia et sur toute la collectivité de Saint-Barth.",
  openGraph: {
    title: "Remplacement kiné Saint-Barth | Soignect",
    description: "Le job board des kinésithérapeutes de Saint-Barthélemy.",
    type: "website",
  },
};

const SAINT_BARTH_COMMUNES = ["Gustavia (Saint-Barth)"];

async function getMissions() {
  return prisma.mission.findMany({
    where: {
      isActive: true,
      location: { in: SAINT_BARTH_COMMUNES },
    },
    include: { profile: { select: { type: true, name: true, ratingAvg: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    take: 20,
  });
}

export default async function SaintBarthPage() {
  const missions = await getMissions();

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 Saint-Barthélemy
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">
          Remplacement kiné Saint-Barth
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          Soignect connecte les kinésithérapeutes de Saint-Barthélemy — collectivité d&apos;outre-mer
          au marché unique, avec une patientèle internationale et des conditions de remplacement
          souvent avantageuses.
        </p>
      </div>

      <div className="bg-gradient-to-br from-kine-600 to-kine-800 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">Rejoignez Soignect gratuitement</p>
          <p className="text-kine-100 text-sm">Remplaçants : accès à vie, sans aucun frais.</p>
        </div>
        <Link
          href="/register"
          className="flex-shrink-0 px-5 py-3 bg-white text-kine-700 rounded-xl font-bold text-sm hover:bg-kine-50 transition"
        >
          S&apos;inscrire →
        </Link>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-4">
        {missions.length > 0
          ? `${missions.length} annonce${missions.length > 1 ? "s" : ""} à Saint-Barth`
          : "Aucune annonce pour le moment — soyez le premier à publier !"}
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      m.profile.type === "TITULAIRE" ? "bg-emerald-100 text-emerald-700" :
                      m.profile.type === "ASSISTANT" ? "bg-violet-100 text-violet-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{typeLabel}</span>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm">{m.title}</h3>
                  <p className="text-gray-400 text-xs mt-1">📍 {m.location}{dateRange ? ` · ${dateRange}` : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 transition">
          Créer mon compte gratuitement →
        </Link>
      </div>

      <div className="mt-12 border-t border-gray-100 pt-8 space-y-3 text-sm text-gray-400">
        <h2 className="text-base font-semibold text-gray-600">Remplacement kiné à Saint-Barthélemy</h2>
        <p>
          Saint-Barthélemy est une collectivité d&apos;outre-mer française distincte de la Guadeloupe
          et de Saint-Martin. Avec environ 10 000 habitants permanents et un tourisme de luxe important,
          les besoins en kinésithérapie sont réguliers tout au long de l&apos;année.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/remplacement-kine-guadeloupe" className="underline hover:text-kine-600">Guadeloupe</Link>
          <span>·</span>
          <Link href="/remplacement-kine-saint-martin" className="underline hover:text-kine-600">Saint-Martin</Link>
        </div>
      </div>
    </div>
  );
}
