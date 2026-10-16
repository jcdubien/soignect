"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Suggestion « poste long terme » (section 191, déplacée et tracée en 272).
//
// ── ELLE A CHANGÉ D'ÉCRAN, ET C'EST TOUT LE CORRECTIF ────────────────────────────────────────
//
// Elle vivait sur `/compte`. Mesuré le 29/09 : 9 remplaçants avaient franchi le seuil, 0 l'avaient
// écartée, 0 avaient publié du long terme ensuite. Zéro écartement sur neuf ne dit pas qu'elle
// échoue à convaincre — ça dit qu'elle n'a probablement jamais été vue. Le geste qui la déclenche
// (retenir deux postes d'assistanat) se fait DANS LE FIL ; la suggestion l'y suit.
//
// ── LE TEXTE RENVOIE UN FAIT, IL NE DEVINE RIEN ──────────────────────────────────────────────
//
// Conservé de la version d'origine : « Vous cherchez peut-être à vous poser ? » présuppose une
// intention et sonne condescendant pour quelqu'un qui vient justement de l'exprimer trois fois.
// On lui rappelle ce qu'il a fait, il en tire la conclusion.
// « d'assistanat, de collaboration ou salariés » — seuls les genres réellement retenus.
function genresRetenus(assistanat: boolean, collaboration: boolean, salariat: boolean): string {
  const parts = [
    assistanat && "d\u2019assistanat",
    collaboration && "de collaboration",
    salariat && "salariés",
  ].filter(Boolean) as string[];
  if (parts.length <= 1) return parts[0] ?? "d\u2019assistanat";
  return `${parts.slice(0, -1).join(", ")} ou ${parts[parts.length - 1]}`;
}

export default function SuggestionLongTerme({
  interets, avecAssistanat, avecCollaboration, avecSalariat, salarie = false,
}: { interets: number; avecAssistanat: boolean; avecCollaboration: boolean; avecSalariat: boolean; salarie?: boolean }) {
  const [ferme, setFerme] = useState(false);
  // L'affichage ne se compte qu'une fois par montage : React monte deux fois en développement
  // (StrictMode), et sans ce garde la mesure d'exposition serait doublée dès le premier jour.
  const vueEnvoyee = useRef(false);

  const tracer = (action: "vue" | "clic" | "ecartee") =>
    fetch("/api/profiles/suggestion-assistanat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => { /* une trace perdue ne doit jamais gêner la navigation */ });

  useEffect(() => {
    if (vueEnvoyee.current) return;
    vueEnvoyee.current = true;
    void tracer("vue");
  }, []);

  // Kiné qui n'a retenu que des postes salariés : même texte « postes durables », et le lien
  // coche d'office « ouvert au salariat » dans le formulaire.
  const toutSalarie = !salarie && avecSalariat && !avecAssistanat && !avecCollaboration;

  if (ferme) return null;

  return (
    <div className="mx-3 mt-2 rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-3 flex items-start gap-3">
      <span className="text-lg leading-none mt-0.5">👩‍⚕️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          {salarie || toutSalarie ? (
            <>
              Vous avez marqué de l&apos;intérêt pour {interets} postes durables. Ces postes se
              cherchent différemment {salarie ? <>d&apos;un CDD ou d&apos;une vacation</> : <>d&apos;un remplacement</>}
              {" "}— sur la durée, pas sur des dates.
            </>
          ) : (
            <>
              Vous avez marqué de l&apos;intérêt pour {interets} postes{" "}
              {genresRetenus(avecAssistanat, avecCollaboration, avecSalariat)}. Ces postes se cherchent différemment
              d&apos;un remplacement — sur la durée, pas sur des dates.
            </>
          )}
        </p>
        <Link
          href={`/disponibilites/create?type=${salarie ? "COLLABORATION" : "ASSISTANAT"}${toutSalarie ? "&salariat=1" : ""}`}
          onClick={() => void tracer("clic")}
          className="inline-block mt-1.5 text-sm font-semibold text-violet-700 hover:underline"
        >
          Publier une recherche de poste long terme →
        </Link>
      </div>
      <button
        type="button"
        onClick={() => { setFerme(true); void tracer("ecartee"); }}
        aria-label="Masquer cette suggestion"
        className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
