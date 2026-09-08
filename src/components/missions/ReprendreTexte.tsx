"use client";

import { useState } from "react";

// « Reprendre un texte précédent » (section 243).
//
// CE QUI EST REPRIS : le texte libre, et rien d'autre. Les dates, la commune, le taux ou la durée
// d'une annonce passée ne sont pas recopiés — ils seraient périmés, et une valeur périmée glissée
// en silence dans un formulaire produit une annonce fausse que personne n'a relue. La route
// `textes-precedents` ne les renvoie même pas : voir le commentaire qui y explique pourquoi la
// garantie vit dans le `select` plutôt que dans cet écran.
//
// LE TITRE NON PLUS n'est pas repris. Il sert seulement à reconnaître de quelle annonce on parle.

export interface TextePrecedent {
  id: string;
  titre: string;
  creeeLe: string;
  rawText: string;
  accroche: string;
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function ReprendreTexte({
  champ,
  valeurActuelle,
  onReprendre,
  exclureId,
}: {
  /** Quel texte on remplit : le libre long (cabinet) ou l'accroche (candidat). */
  champ: "rawText" | "accroche";
  /** Contenu déjà saisi — sert à prévenir avant de l'écraser. */
  valeurActuelle: string;
  onReprendre: (texte: string) => void;
  exclureId?: string | null;
}) {
  const [ouvert, setOuvert] = useState(false);
  // Texte tel qu'il était avant la reprise — null = rien à annuler.
  //
  // POURQUOI PAS `confirm()`. Le produit ne s'en sert que dans les écrans d'ADMINISTRATION ;
  // aucun écran utilisateur n'ouvre de boîte native. Et ce formulaire a déjà son motif pour son
  // seul autre geste destructif, la reformulation IA : il remplace, puis propose d'annuler. Une
  // question posée avant le geste force à trancher sans voir le résultat ; un retour arrière
  // après coup laisse comparer. On suit le motif de la maison.
  const [texteAvant, setTexteAvant] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [annonces, setAnnonces] = useState<TextePrecedent[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ouvrir() {
    setOuvert(true);
    if (annonces !== null) return; // déjà chargé, on ne redemande pas
    setChargement(true);
    setErreur(null);
    try {
      const url = `/api/missions/textes-precedents${exclureId ? `?exclure=${exclureId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) { setErreur("Impossible de charger vos annonces précédentes."); return; }
      setAnnonces(await res.json());
    } catch {
      setErreur("Erreur réseau.");
    } finally {
      setChargement(false);
    }
  }

  /** Texte d'une annonce pour LE champ visé, avec repli sur l'autre quand il est vide : une
   *  ancienne annonce peut n'avoir qu'une accroche, une récente qu'un texte long. */
  const texteDe = (a: TextePrecedent) =>
    champ === "rawText" ? (a.rawText || a.accroche) : (a.accroche || a.rawText);

  function appliquer(a: TextePrecedent) {
    const texte = texteDe(a);
    if (!texte.trim()) return;
    // On ne mémorise que s'il y avait quelque chose à perdre : proposer d'annuler vers un champ
    // vide n'aiderait personne et ferait du bruit sur le cas le plus fréquent, le premier jet.
    setTexteAvant(valeurActuelle.trim() ? valeurActuelle : null);
    onReprendre(texte);
    setOuvert(false);
  }

  if (!ouvert) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={ouvrir}
          className="text-xs font-semibold text-kine-700 hover:underline"
        >
          ↩︎ Reprendre un texte précédent
        </button>
        {texteAvant !== null && (
          <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span className="text-amber-800">Votre texte a été remplacé.</span>
            <button
              type="button"
              onClick={() => { onReprendre(texteAvant); setTexteAvant(null); }}
              className="ml-auto shrink-0 font-bold text-amber-900 underline hover:text-amber-950"
            >
              Annuler la reprise
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-kine-200 bg-kine-50/50 px-3 py-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-bold text-kine-800">Reprendre un texte précédent</p>
          <p className="text-[11px] text-kine-600/80 leading-snug mt-0.5">
            Seul le texte est repris. Les dates, la commune et les montants restent à saisir —
            ceux d&apos;une ancienne annonce ne valent plus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-xs text-kine-600 hover:text-kine-800 shrink-0"
        >
          Fermer
        </button>
      </div>

      {chargement && <p className="text-xs text-kine-600">Chargement…</p>}
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}

      {annonces !== null && annonces.length === 0 && (
        <p className="text-xs text-kine-600">
          Aucune annonce précédente à reprendre — c&apos;est votre première publication.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {(annonces ?? []).map((a) => {
          const texte = texteDe(a);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => appliquer(a)}
              className="text-left rounded-lg border border-kine-200 bg-white px-3 py-2 hover:border-kine-400 transition"
            >
              <span className="block text-xs font-semibold text-gray-800 truncate">
                {a.titre || "Annonce sans titre"}
              </span>
              <span className="block text-[10px] text-gray-400 mt-0.5">
                Publiée le {dateCourte(a.creeeLe)}
              </span>
              <span className="block text-[11px] text-gray-500 mt-1 line-clamp-2 leading-snug">
                {texte.slice(0, 160)}{texte.length > 160 ? "…" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
