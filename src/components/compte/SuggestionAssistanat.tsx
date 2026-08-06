"use client";

import { useState } from "react";
import Link from "next/link";

// Bandeau de suggestion (section 191). Discret et fermable — jamais une modale.
//
// LE TEXTE RENVOIE UN FAIT, IL NE DEVINE RIEN. « Vous cherchez peut-être à vous poser ? »
// présuppose une intention et sonne condescendant pour quelqu'un qui vient justement de
// l'exprimer trois fois. On lui rappelle ce qu'il a fait, il en tire la conclusion.
export default function SuggestionAssistanat({ interets }: { interets: number }) {
  const [ferme, setFerme] = useState(false);
  if (ferme) return null;

  async function ecarter() {
    setFerme(true); // fermeture immédiate : l'enregistrement ne doit pas faire attendre
    await fetch("/api/profiles/suggestion-assistanat", { method: "POST" }).catch(() => {});
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-3 flex items-start gap-3">
      <span className="text-lg leading-none mt-0.5">👩‍⚕️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          Vous avez marqué de l&apos;intérêt pour {interets} postes d&apos;assistanat ou de
          collaboration. Ces postes se cherchent différemment d&apos;un remplacement — sur la durée,
          pas sur des dates.
        </p>
        <Link
          href="/disponibilites/create?type=ASSISTANAT"
          className="inline-block mt-1.5 text-sm font-semibold text-violet-700 hover:underline"
        >
          Publier une recherche de poste long terme →
        </Link>
      </div>
      <button
        type="button"
        onClick={ecarter}
        aria-label="Masquer cette suggestion"
        className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
