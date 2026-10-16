"use client";

import { useEffect, useState } from "react";

// Liste cliquable du module embarquable (15/10, demande de JC).
//
// Un poste listé sur le site d'une CPTS ne doit pas jeter le visiteur hors du site au premier
// clic : il ouvre d'abord une fiche, DANS l'iframe, avec ce que la page publique montre sans
// compte (type, lieu, période, rémunération, accroche tronquée). De là, deux suites :
//   • voir l'annonce sur Soignect ;
//   • se proposer sur CES dates — le formulaire de disponibilité s'ouvre pré-rempli. Hors
//     connexion, la connexion (ou l'inscription) garde le chemin et y revient (section 290).
// Les deux liens s'ouvrent hors de l'iframe : un parcours de compte n'a rien à faire dans un
// cadre de quelques centaines de pixels sur un site tiers.

export interface PosteEmbed {
  id: string;
  titre: string;
  libelle: string;        // « Remplacement · Kinésithérapeute », « CDI »…
  lieu: string;
  periode: string | null;
  /** Bornes ISO (AAAA-MM-JJ) ; null si le poste n'a pas de période fermée. */
  debut: string | null;
  fin: string | null;
  remuneration: string | null;
  accroche: string | null;
  prioritaire: boolean;
}

export default function PostesEmbed({ postes, src }: { postes: PosteEmbed[]; src: string }) {
  const [ouvert, setOuvert] = useState<PosteEmbed | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert]);

  return (
    <>
      <ul className="list-none p-0 m-0 space-y-2">
        {postes.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOuvert(p)}
              className={`w-full text-left block rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                p.prioritaire ? "border-2 border-[#0B3D5C] bg-white" : "border border-gray-200 bg-transparent"
              }`}
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                {p.prioritaire && (
                  <span className="text-[10px] font-bold text-white bg-[#0B3D5C] rounded px-1.5 py-0.5 uppercase tracking-wide">
                    Zone prioritaire
                  </span>
                )}
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{p.libelle}</span>
                <span className="text-[11px] text-gray-400">
                  {p.lieu}{p.periode ? ` · ${p.periode}` : ""}
                </span>
              </div>
              <p className="text-sm font-semibold m-0 mt-0.5 text-[#1f2937]">{p.titre}</p>
            </button>
          </li>
        ))}
      </ul>

      {ouvert && (
        // Alignée en HAUT, pas centrée : l'iframe peut être à peine plus haute que la liste, et
        // une fiche centrée y serait coupée.
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-3"
          onClick={() => setOuvert(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={ouvert.titre}
            className="w-full max-w-md max-h-full overflow-y-auto bg-white rounded-xl shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                {ouvert.prioritaire && (
                  <span className="text-[10px] font-bold text-white bg-[#0B3D5C] rounded px-1.5 py-0.5 uppercase tracking-wide">
                    Zone prioritaire
                  </span>
                )}
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{ouvert.libelle}</span>
              </div>
              <button
                type="button"
                onClick={() => setOuvert(null)}
                aria-label="Fermer"
                className="shrink-0 text-gray-400 hover:text-gray-600 text-xl leading-none bg-transparent border-0 cursor-pointer"
              >
                ×
              </button>
            </div>
            <p className="text-base font-bold m-0 mt-1 text-[#1f2937]">{ouvert.titre}</p>
            <p className="text-sm text-gray-500 m-0 mt-1">📍 {ouvert.lieu}</p>
            {ouvert.periode && <p className="text-sm text-gray-500 m-0 mt-0.5">📅 {ouvert.periode}</p>}
            {ouvert.remuneration && <p className="text-sm text-gray-500 m-0 mt-0.5">💶 {ouvert.remuneration}</p>}
            {ouvert.accroche && (
              <p className="text-sm text-gray-700 italic m-0 mt-3 border-l-2 border-gray-300 pl-3">{ouvert.accroche}</p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {/* « Ça m'intéresse » ouvre la fiche de CE poste dans Soignect (`/annonces?card=`),
                  là où le geste se vérifie sur le planning du candidat (section 306) : refusé
                  s'il est pris, proposition de publier ses jours libres sinon. Il menait au
                  formulaire de disponibilité, qui ne vérifiait rien et ne disait rien au
                  recruteur. Hors connexion, la connexion garde le chemin (section 290). */}
              <a
                href={`/annonces?card=${ouvert.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center px-4 py-2.5 rounded-lg bg-[#0B3D5C] text-white text-sm font-semibold no-underline"
              >
                Ça m&apos;intéresse →
              </a>
              <a
                href={`/annonce/${ouvert.id}?src=${src}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold no-underline border border-[#0B3D5C] text-[#0B3D5C] bg-white"
              >
                Voir l&apos;annonce sur Soignect →
              </a>
              <p className="text-[11px] text-gray-400 text-center m-0">
                {ouvert.debut && ouvert.fin
                  ? "Soignect vérifie vos dates sur votre planning et vous propose de publier vos jours libres."
                  : "Connectez-vous ou créez votre compte gratuit pour signaler votre intérêt."}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
