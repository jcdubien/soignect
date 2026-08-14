import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KINESITHERAPEUTE, TERRITOIRES, PORTES, cheminPage, cleTracePage } from "@/lib/pagesDiffusion";
import { filtreAnnoncesVivantes, PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import { tracerVueLanding } from "@/lib/traceLanding";
import { ZONE_LABELS, COMMUNE_ZONE } from "@/lib/communes";

export const dynamic = "force-dynamic";

// Porte MSP / CPTS / TERRITOIRE (section 212).
//
// ELLE NE SUIT PAS LE GABARIT DES TROIS AUTRES, et c'est délibéré. Les portes chercheur,
// cabinet et établissement s'adressent à quelqu'un qui vient CHERCHER ou POURVOIR un poste :
// une liste d'annonces y est la preuve et l'argument. Une CPTS ne cherche pas un poste — elle
// pilote une offre de soins sur un territoire. Lui présenter un fil d'annonces répondrait à
// côté ; ce qu'elle veut voir, c'est la RÉPARTITION et ce qu'elle peut en faire.
//
// Le traitement de diffusion, lui, est identique : même trace, même entrée dans
// /admin/diffusion, même bouton de partage. C'est la mise en page qui diffère, pas le régime.
const PRO   = KINESITHERAPEUTE;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.TERRITOIRE;

export const metadata: Metadata = {
  alternates: { canonical: cheminPage(PORTE, PRO, TERR) },
  title: PORTE.metaTitre(PRO, TERR),
  description: PORTE.metaDescription(PRO, TERR),
  openGraph: {
    url: cheminPage(PORTE, PRO, TERR),
    title: PORTE.metaTitre(PRO, TERR),
    description: PORTE.metaDescription(PRO, TERR),
    type: "website",
  },
};

export default async function Page() {
  const missions = await prisma.mission.findMany({
    where: filtreAnnoncesVivantes(PERIMETRE_GUADELOUPE.zones, PERIMETRE_GUADELOUPE.communes),
    select: { location: true, zones: true },
    take: 200,
  });

  await tracerVueLanding(cleTracePage(PORTE, PRO, TERR), missions.length);

  // Répartition par macro-zone — la commune publiée est résolue par COMMUNE_ZONE, source
  // unique du découpage (section 211). Une annonce sans commune connue retombe sur ses zones
  // déclarées ; sinon elle n'est comptée nulle part plutôt que rangée arbitrairement.
  const parZone = new Map<string, number>();
  for (const m of missions) {
    const z = COMMUNE_ZONE[m.location] ?? m.zones[0];
    if (z) parZone.set(z, (parZone.get(z) ?? 0) + 1);
  }
  const repartition = Array.from(parZone.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 {TERR.nom} · CPTS, MSP, collectivités
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">{PORTE.titre(PRO, TERR)}</h1>
        <p className="text-gray-500 text-base leading-relaxed">{PORTE.accroche(PRO, TERR)}</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-gray-800 mb-1">
          Postes ouverts aujourd&apos;hui, par zone
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Répartition en direct des annonces actives {TERR.preposition} {TERR.nom}.
        </p>
        {repartition.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune annonce active pour le moment.</p>
        ) : (
          <ul className="space-y-1.5">
            {repartition.map(([zone, n]) => (
              <li key={zone} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-700">{ZONE_LABELS[zone as keyof typeof ZONE_LABELS] ?? zone}</span>
                <span className="font-bold text-gray-900">{n}</span>
              </li>
            ))}
          </ul>
        )}
        {/* EMPLACEMENT RÉSERVÉ — indicateur de tension (v2). Même réserve que sur le module
            embarquable : le zonage ARS est un classement réglementaire régional, l'APL de la
            DREES une donnée nationale brute. Ne rien afficher tant que la source n'est pas
            tranchée — un chiffre de tension faux devant une CPTS coûte plus cher que rien. */}
      </div>

      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-bold text-gray-800">Ce que Soignect apporte à un territoire</h2>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="font-semibold text-gray-800 text-sm mb-1">Une vue sur les postes ouverts</p>
          <p className="text-sm text-gray-500">
            Combien de postes cherchent preneur, où, et depuis quand — sur les communes de votre
            territoire, sans avoir à interroger les cabinets un par un.
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="font-semibold text-gray-800 text-sm mb-1">Un module à intégrer sur votre site</p>
          <p className="text-sm text-gray-500">
            Les postes ouverts de votre territoire, affichés directement sur votre propre site,
            en une balise à coller. Mis à jour tout seul.
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="font-semibold text-gray-800 text-sm mb-1">
            Des contrats conformes, pas seulement des mises en relation
          </p>
          <p className="text-sm text-gray-500">
            Modèles CNOMK pré-remplis, vérification de l&apos;inscription à l&apos;Ordre avant
            signature : ce qui se noue sur la plateforme tient juridiquement.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-kine-600 to-kine-800 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">Discutons de votre territoire</p>
          <p className="text-kine-100 text-sm">{PORTE.ctaSous}</p>
        </div>
        <Link
          href="/register"
          className="flex-shrink-0 px-5 py-3 bg-white text-kine-700 rounded-xl font-bold text-sm hover:bg-kine-50 transition"
        >
          {PORTE.cta}
        </Link>
      </div>

      <div className="mt-12 border-t border-gray-100 pt-8 space-y-3 text-sm text-gray-400">
        <h2 className="text-base font-semibold text-gray-600">
          Soignect pour les CPTS, MSP et collectivités
        </h2>
        {/* Rien ici qui ne soit vrai par construction (règle du 10/08). Aucune promesse de
            résultat, aucun chiffre de marché : le compteur de postes ci-dessus est la seule
            donnée avancée, et elle est calculée en direct. */}
        <p>
          Soignect référence les postes de {PRO.discipline} publiés par les cabinets et les
          professionnels eux-mêmes {TERR.preposition} {TERR.nom}. Les structures territoriales y
          accèdent pour suivre l&apos;offre sur leur périmètre et l&apos;afficher sur leur propre
          site. L&apos;inscription est gratuite pour qui cherche un poste.
        </p>
      </div>
    </div>
  );
}
