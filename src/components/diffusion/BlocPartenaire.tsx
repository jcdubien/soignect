import Link from "next/link";
import type { Profession } from "@/lib/pagesDiffusion";
import { TARIFS_PARTENAIRE, VENTE_EN_LIGNE_OUVERTE, euros } from "@/lib/tarifsPartenaire";
import { OFFRE_PARTENAIRE_FACULTATIVE } from "@/lib/gratuite";

// L'offre PARTENAIRE (section 301) — ce qui distingue une structure qui pilote un territoire
// d'une structure qui pourvoit un poste.
//
// Le levier existe depuis la section 214 et n'était annoncé nulle part : une déclaration
// commune × profession, portée par une relation client active (`ClientInstitutionnel`), fait
// remonter les annonces de la commune dans le fil des candidats de la profession, avec la
// mention « déclarée prioritaire par <structure> ». Chaque phrase ci-dessous décrit ce
// mécanisme tel qu'il tourne — rien de plus :
//   • la remontée porte sur l'ORDRE du fil, pas sur le score de compatibilité ;
//   • elle vaut pour TOUTES les annonces de la commune, pas pour celles du partenaire seul —
//     c'est une zone en tension qu'on promeut, pas un employeur ;
//   • la structure ne la règle pas elle-même : elle la demande, l'administrateur la saisit
//     (section 233), avec une échéance de revue qui éteint le levier si elle passe.
// Les prix viennent de `TARIFS_PARTENAIRE` (section 303) ; la ligne de la porte visitée est
// mise en évidence, les autres restent visibles — une MSP voit aussi ce que paie une CPTS.
export default function BlocPartenaire({ profession, inscription, porteSlug, facultative = false }: { profession: Profession; inscription: string; porteSlug: string; facultative?: boolean }) {
  return (
    <div className="mt-10 rounded-2xl border border-kine-200 bg-kine-50 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-kine-700 mb-1">Offre partenaire</p>
      {/* Point 3 (22/10) : sur une page « emploi », la grille de prix suivait l'appel à publier
          sans dire que la publication, elle, est gratuite. */}
      {facultative && <p className="text-xs text-gray-600 mb-2">{OFFRE_PARTENAIRE_FACULTATIVE}</p>}
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        Au-delà du poste du moment : faites remonter vos zones en tension
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        CPTS, maison de santé, hôpital, EHPAD : en devenant partenaire, vous déclarez les communes
        où une profession manque. Les annonces de ces communes remontent dans le fil des{" "}
        {profession.pluriel} disponibles. Vous orientez l&apos;offre vers vos objectifs de
        territoire, pas seulement vers un recrutement ponctuel.
      </p>
      <ul className="space-y-2 text-sm text-gray-700 mb-5">
        <li>📍 <strong>Vos communes, vos professions</strong> — vous choisissez où, et pour quel métier.</li>
        <li>🏷️ <strong>Une mise en avant signée</strong> — l&apos;annonce indique qu&apos;elle est « déclarée prioritaire » par votre structure.</li>
        <li>📊 <strong>Un espace partenaire</strong> — postes ouverts, praticiens disponibles et mises en relation sur votre territoire.</li>
        <li>🗓️ <strong>Une durée convenue</strong> — communes et échéance fixées ensemble, revues à terme.</li>
      </ul>
      <div className="overflow-x-auto -mx-1 mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-kine-200 text-xs text-gray-500">
              <th className="text-left font-semibold py-2 px-1">Structure</th>
              <th className="text-right font-semibold py-2 px-1 whitespace-nowrap">Par an</th>
              <th className="text-right font-semibold py-2 px-1 whitespace-nowrap">Lancement</th>
            </tr>
          </thead>
          <tbody>
            {TARIFS_PARTENAIRE.filter((t) => !t.prive).map((t) => {
              const vous = t.portes.includes(porteSlug);
              return (
                <tr key={t.cle} className={`border-b border-kine-100 ${vous ? "bg-white" : ""}`}>
                  <td className="py-2 px-1">
                    <span className={`block ${vous ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>{t.pour}</span>
                    <span className="block text-xs text-gray-500">{t.contenu}</span>
                    {VENTE_EN_LIGNE_OUVERTE && t.lienPaiement && (
                      <a
                        href={t.lienPaiement}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-xs font-bold text-kine-700 underline"
                      >
                        Souscrire en ligne →
                      </a>
                    )}
                  </td>
                  <td className="py-2 px-1 text-right whitespace-nowrap tabular-nums text-gray-500 align-top">
                    {t.aPartirDe && <span className="text-xs">dès </span>}<s>{euros(t.prixAn)}</s>
                  </td>
                  <td className="py-2 px-1 text-right whitespace-nowrap tabular-nums font-bold text-kine-700 align-top">
                    {euros(t.lancementAn)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Prix HT, engagement d&apos;un an. Tarif de lancement réservé aux 5 premiers partenaires,
        pour la première année.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Link
          href={inscription}
          className="inline-flex justify-center px-5 py-3 bg-kine-600 text-white rounded-xl font-bold text-sm hover:bg-kine-700 transition"
        >
          Devenir partenaire →
        </Link>
      </div>
    </div>
  );
}
