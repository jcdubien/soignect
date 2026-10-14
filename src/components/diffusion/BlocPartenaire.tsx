import Link from "next/link";
import type { Profession } from "@/lib/pagesDiffusion";

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
// Aucun prix : il n'en existe pas d'arrêté, et un chiffre inventé ici serait cru.
export default function BlocPartenaire({ profession, inscription }: { profession: Profession; inscription: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-kine-200 bg-kine-50 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-kine-700 mb-1">Offre partenaire</p>
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        Au-delà du poste du moment : faites remonter vos zones en tension
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        CPTS, maison de santé, hôpital, EHPAD : en devenant partenaire, vous déclarez les communes
        où une profession manque. Les annonces de ces communes remontent en tête du fil des{" "}
        {profession.pluriel} disponibles. Vous orientez l&apos;offre vers vos objectifs de
        territoire, pas seulement vers un recrutement ponctuel.
      </p>
      <ul className="space-y-2 text-sm text-gray-700 mb-5">
        <li>📍 <strong>Vos communes, vos professions</strong> — vous choisissez où, et pour quel métier.</li>
        <li>🏷️ <strong>Une mise en avant signée</strong> — l&apos;annonce indique qu&apos;elle est « déclarée prioritaire » par votre structure.</li>
        <li>📊 <strong>Un espace partenaire</strong> — postes ouverts, praticiens disponibles et mises en relation sur votre territoire.</li>
        <li>🗓️ <strong>Une durée convenue</strong> — communes et échéance fixées ensemble, revues à terme.</li>
      </ul>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Link
          href={inscription}
          className="inline-flex justify-center px-5 py-3 bg-kine-600 text-white rounded-xl font-bold text-sm hover:bg-kine-700 transition"
        >
          Devenir partenaire →
        </Link>
        <p className="text-xs text-gray-500">Offre payante, sur devis.</p>
      </div>
    </div>
  );
}
