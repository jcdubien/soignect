import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KINESITHERAPEUTE, TERRITOIRES, PORTES, VOCABULAIRE_PROFESSION, PAGES_PUBLIEES, cheminPage, cleTracePage } from "@/lib/pagesDiffusion";
import type { Profession } from "@/lib/pagesDiffusion";
import { filtreAnnoncesVivantes, PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import { tracerVueLanding } from "@/lib/traceLanding";
import BlocPartenaire from "@/components/diffusion/BlocPartenaire";
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

// Une CPTS pilote TOUTES les professions de son territoire : le tableau croise zone ×
// profession au lieu de ne compter que celle du slug. Les colonnes sont les professions qui ont
// un vocabulaire déclaré — une profession sans libellé n'a pas de colonne à inventer.
const PROFESSIONS_TABLEAU = Object.values(VOCABULAIRE_PROFESSION) as Profession[];

export default async function Page() {
  const parProfession = await Promise.all(
    PROFESSIONS_TABLEAU.map((p) =>
      prisma.mission.findMany({
        where: filtreAnnoncesVivantes(PERIMETRE_GUADELOUPE.zones, PERIMETRE_GUADELOUPE.communes, p.enumBase, PORTE.montre),
        select: { location: true, zones: true },
        take: 200,
      }),
    ),
  );
  const total = parProfession.reduce((n, l) => n + l.length, 0);

  // Le compteur de trace suit ce que le visiteur voit : toutes professions confondues.
  await tracerVueLanding(cleTracePage(PORTE, PRO, TERR), total);

  // Répartition par macro-zone — la commune publiée est résolue par COMMUNE_ZONE, source
  // unique du découpage (section 211). Une annonce sans commune connue retombe sur ses zones
  // déclarées ; sinon elle n'est comptée nulle part plutôt que rangée arbitrairement.
  const parZone = new Map<string, number[]>();
  parProfession.forEach((missions, i) => {
    for (const m of missions) {
      const z = COMMUNE_ZONE[m.location] ?? m.zones[0];
      if (!z) continue;
      const ligne = parZone.get(z) ?? PROFESSIONS_TABLEAU.map(() => 0);
      ligne[i] += 1;
      parZone.set(z, ligne);
    }
  });
  const somme = (l: number[]) => l.reduce((a, b) => a + b, 0);
  const repartition = Array.from(parZone.entries()).sort((a, b) => somme(b[1]) - somme(a[1]));
  const totauxColonnes = PROFESSIONS_TABLEAU.map((_, i) => somme(repartition.map(([, l]) => l[i])));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 {TERR.nom} · CPTS, collectivités
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">{PORTE.titre(PRO, TERR)}</h1>
        <p className="text-gray-500 text-base leading-relaxed">{PORTE.accroche(PRO, TERR)}</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-gray-800 mb-1">
          Postes ouverts aujourd&apos;hui, par zone et par profession
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Répartition en direct des annonces actives {TERR.preposition} {TERR.nom}.
        </p>
        {repartition.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune annonce active pour le moment.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left font-semibold py-2 px-1">Zone</th>
                  {PROFESSIONS_TABLEAU.map((p) => (
                    <th key={p.slug} className="text-right font-semibold py-2 px-1 capitalize">{p.courtPluriel}</th>
                  ))}
                  <th className="text-right font-semibold py-2 px-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {repartition.map(([zone, ligne]) => (
                  <tr key={zone} className="border-b border-gray-50">
                    <td className="py-1.5 px-1 text-gray-700">{ZONE_LABELS[zone as keyof typeof ZONE_LABELS] ?? zone}</td>
                    {ligne.map((n, i) => (
                      <td key={i} className={`py-1.5 px-1 text-right tabular-nums ${n ? "text-gray-900" : "text-gray-300"}`}>{n || "–"}</td>
                    ))}
                    <td className="py-1.5 px-1 text-right font-bold text-gray-900 tabular-nums">{somme(ligne)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-xs font-bold text-gray-800">
                  <td className="pt-2 px-1">Total</td>
                  {totauxColonnes.map((n, i) => (
                    <td key={i} className="pt-2 px-1 text-right tabular-nums">{n}</td>
                  ))}
                  <td className="pt-2 px-1 text-right tabular-nums">{somme(totauxColonnes)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
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
            Modèles de l&apos;Ordre pré-remplis pour chaque profession, coordonnées
            professionnelles demandées avant signature.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-kine-600 to-kine-800 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">Discutons de votre territoire</p>
          <p className="text-kine-100 text-sm">{PORTE.ctaSous}</p>
        </div>
        <Link
          // Provenance seule (section 86), sans profession : une CPTS n'en exerce pas une, et
          // présélectionner « kiné » parce que la page en parle fausserait son inscription.
          href={`/register?src=${cleTracePage(PORTE, PRO, TERR)}`}
          className="flex-shrink-0 px-5 py-3 bg-white text-kine-700 rounded-xl font-bold text-sm hover:bg-kine-50 transition"
        >
          {PORTE.cta}
        </Link>
      </div>

      <div className="mb-8 -mt-2">
        <BlocPartenaire profession={PRO} inscription={`/register?src=partenaire-${PORTE.slug}-${PRO.slug}`} porteSlug={PORTE.slug} />
      </div>

      {/* Une MSP ou un établissement recrute : leur page est celle d'un employeur, pas celle-ci
          (sections 299, 304). Les liens se dérivent du registre des pages publiées. */}
      <div className="mb-8 space-y-2">
      {[
        { porte: PORTES.MAISON_DE_SANTE, question: "Vous êtes une maison de santé qui recrute ?" },
        { porte: PORTES.ETABLISSEMENT, question: "Vous êtes un EHPAD, une SSR, une clinique ou un hôpital ?" },
      ].map(({ porte, question }) => (
        <p key={porte.slug} className="text-sm text-gray-500">
          {question}{" "}
          {PAGES_PUBLIEES.filter((x) => x.porte.slug === porte.slug && x.territoire === TERR).map((x, i) => (
            <span key={x.profession.slug}>
              {i > 0 && " · "}
              <Link href={cheminPage(x.porte, x.profession, TERR)} className="underline text-kine-700">{x.profession.unSingulier}</Link>
            </span>
          ))}
        </p>
      ))}
      </div>

      <div className="mt-12 border-t border-gray-100 pt-8 space-y-3 text-sm text-gray-400">
        <h2 className="text-base font-semibold text-gray-600">
          Soignect pour les CPTS et les collectivités
        </h2>
        {/* Rien ici qui ne soit vrai par construction (règle du 10/08). Aucune promesse de
            résultat, aucun chiffre de marché : le compteur de postes ci-dessus est la seule
            donnée avancée, et elle est calculée en direct. */}
        <p>
          Soignect référence les postes de kinés, d&apos;infirmiers et d&apos;aides-soignants publiés
          par les cabinets, les structures et les professionnels eux-mêmes {TERR.preposition} {TERR.nom}. Les structures territoriales y
          accèdent pour suivre l&apos;offre sur leur périmètre et l&apos;afficher sur leur propre
          site. L&apos;inscription est gratuite pour qui cherche un poste.
        </p>
      </div>
    </div>
  );
}
