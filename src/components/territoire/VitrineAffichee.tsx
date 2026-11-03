import { RUBRIQUES_VITRINE, type VitrinePublique } from "@/lib/vitrineTerritoire";

// Rendu d'une vitrine du territoire (02/11) — le même partout : page publique de la structure,
// carte d'un besoin dans le fil, aperçu de la page de gestion, écran de validation. Sans état :
// utilisable côté serveur comme côté client.

export default function VitrineAffichee({ vitrine, titre, compacte = false }: {
  vitrine: VitrinePublique;
  /** Titre de la section, absent dans le fil (la carte le porte déjà). */
  titre?: string;
  compacte?: boolean;
}) {
  const rubriques = RUBRIQUES_VITRINE.filter((r) => (vitrine[r.cle] ?? "").trim());
  return (
    <section className={compacte ? "" : "mt-6"}>
      {titre && <h2 className="text-base font-bold text-[#0B3D5C] m-0">{titre}</h2>}
      <p className={`${compacte ? "text-sm" : "text-[15px]"} font-semibold text-gray-900 ${titre ? "mt-1" : "mt-0"} mb-0`}>{vitrine.accroche}</p>
      {vitrine.photos.length > 0 && (
        <div className={`mt-3 grid gap-2 ${vitrine.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {vitrine.photos.map((p) => (
            <figure key={p.url} className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.legende || "Photo du territoire"} loading="lazy"
                className={`w-full ${compacte ? "h-28" : "h-40"} object-cover rounded-lg bg-gray-100`} />
              {p.legende && <figcaption className="text-[11px] text-gray-500 mt-1">{p.legende}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {rubriques.map((r) => (
        <div key={r.cle} className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 m-0">{r.titre}</p>
          <p className="text-sm text-gray-700 whitespace-pre-line mt-1 mb-0">{vitrine[r.cle]}</p>
        </div>
      ))}
      <p className="text-[11px] text-gray-400 mt-3 mb-0">Présentation rédigée par la structure.</p>
    </section>
  );
}
