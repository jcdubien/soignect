import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ZoneGeographique } from "@prisma/client";
import { filtreAnnoncesVivantes } from "@/lib/annoncesTerritoire";
import { tracerVueLanding } from "@/lib/traceLanding";
import { Porte, Profession, Territoire, cleTracePage } from "@/lib/pagesDiffusion";

// Gabarit commun des pages de diffusion « à annonces » (section 212) — portes CABINET et
// ÉTABLISSEMENT. La porte CHERCHEUR garde ses trois pages historiques, vérifiées à l'écran :
// on ne les réécrit pas pour un gain de forme.
//
// Ce composant ne connaît NI profession NI territoire : il reçoit les trois axes et compose.
// C'est ce qui permet d'ajouter une porte sans le toucher.

export default async function PagePorte({
  porte, profession, territoire, zones, communes, basDePage,
}: {
  porte: Porte;
  profession: Profession;
  territoire: Territoire;
  zones: ZoneGeographique[];
  communes: string[];
  /** Bas de page propre à la porte — ce qui est vrai par construction, jamais du marché. */
  basDePage: React.ReactNode;
}) {
  const missions = await prisma.mission.findMany({
    // Le camp vient de la PORTE, qui le déclare : une porte employeur montre des candidats.
    where: filtreAnnoncesVivantes(zones, communes, profession.enumBase, porte.montre),
    include: { profile: { select: { type: true, name: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    // Échantillon, pas inventaire : 8 suffisent à montrer qu'il se passe quelque chose.
    // Au-delà, la page devient une liste à faire défiler et le CTA disparaît sous le pli.
    take: 8,
  });

  await tracerVueLanding(cleTracePage(porte, profession, territoire), missions.length);

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 {territoire.nom}
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">
          {porte.titre(profession, territoire)}
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          {porte.accroche(profession, territoire)}
        </p>
      </div>

      <div className="bg-gradient-to-br from-kine-600 to-kine-800 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">Rejoignez Soignect</p>
          <p className="text-kine-100 text-sm">{porte.ctaSous}</p>
        </div>
        <Link
          href="/register"
          className="flex-shrink-0 px-5 py-3 bg-white text-kine-700 rounded-xl font-bold text-sm hover:bg-kine-50 transition"
        >
          {porte.cta}
        </Link>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-4">
        {missions.length > 0
          ? `${missions.length} annonce${missions.length > 1 ? "s" : ""} ${territoire.preposition} ${territoire.nom}`
          : "Aucune annonce pour le moment — soyez le premier à publier !"}
      </h2>

      {missions.length > 0 && (
        <div className="space-y-3">
          {missions.map((m) => {
            const periode =
              m.startDate && m.endDate ? `${fmt(m.startDate)} → ${fmt(m.endDate)}`
              : m.startDate ? `dès le ${fmt(m.startDate)}`
              : m.minMonths ? `${m.minMonths} mois min.`
              : null;
            const label = { REMPLACANT: "Remplaçant", ASSISTANT: "Assistant", TITULAIRE: "Cabinet" }[m.profile.type];
            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    m.profile.type === "TITULAIRE" ? "bg-emerald-100 text-emerald-700" :
                    m.profile.type === "ASSISTANT" ? "bg-violet-100 text-violet-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{label}</span>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">{m.title}</h3>
                <p className="text-gray-400 text-xs mt-1">
                  📍 {m.location}{periode ? ` · ${periode}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 transition">
          {porte.cta}
        </Link>
      </div>

      {/* NE GARDER ICI QUE CE QUI EST VRAI PAR CONSTRUCTION (règle du 10/08, réaffirmée le
          12/08) : ce que fait Soignect, les types de poste, le statut du territoire. Aucune
          caractérisation de marché — personne ici ne peut la sourcer. */}
      <div className="mt-12 border-t border-gray-100 pt-8 space-y-3 text-sm text-gray-400">
        {basDePage}
      </div>
    </div>
  );
}
