"use client";

import { useEffect, useState } from "react";

// Bande « personnes signalées » (section 206) — côté CABINET, pour l'annonce sélectionnée.
//
// Elle ne montre QUE des gens sans recherche publiée. Les autres sont déjà atteignables : leur
// disponibilité passe dans le feed, on peut la swiper. Ceux-ci n'apparaissent nulle part —
// le badge « N candidatures en attente » les comptait sans jamais pouvoir les présenter.
//
// Ce n'est pas une liste de profils navigables : chaque ligne résulte d'un geste explicite
// de la personne sur CETTE annonce, et n'existe que là.
interface Interesse {
  profileId: string;
  name: string | null;
  type: string;
  accroche: string | null;
  aPublieUneRecherche: boolean;
  date: string;
}

export default function InteressesSansRecherche({ missionId }: { missionId: string }) {
  const [items, setItems] = useState<Interesse[]>([]);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const r = await fetch(`/api/missions/${missionId}/interesses`);
        if (!r.ok) return;
        const d = await r.json();
        if (!annule) setItems((d.interesses ?? []).filter((i: Interesse) => !i.aPublieUneRecherche));
      } catch { /* silencieux : cette bande est un complément, jamais un bloquant */ }
    })();
    return () => { annule = true; };
  }, [missionId]);

  if (items.length === 0) return null;

  return (
    <div className="shrink-0 mx-4 mt-2 rounded-xl border border-amber-200 bg-amber-50/60">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`text-amber-600 transition-transform ${ouvert ? "rotate-90" : ""}`}>▸</span>
        {/* L'accord porte sur TOUTE la phrase, pas seulement sur « personne(s) » : au pluriel
            l'écran affichait « 3 personnes s'est signalée ». Constaté en production le 03/09 —
            troisième occurrence de ce défaut cette semaine, toujours la même cause : un `s`
            conditionnel greffé sur un seul mot d'une phrase qui en accorde plusieurs. */}
        <span className="text-xs font-bold text-amber-800">
          {items.length > 1
            ? `${items.length} personnes se sont signalées sur cette annonce`
            : "1 personne s'est signalée sur cette annonce"}
        </span>
        <span className="text-[11px] text-amber-700/80 font-normal">
          sans recherche publiée — invisible{items.length > 1 ? "s" : ""} dans le fil
        </span>
      </button>

      {ouvert && (
        <div className="px-3 pb-3 space-y-2">
          {items.map((i) => (
            <div key={i.profileId} className="rounded-lg bg-white border border-amber-100 px-3 py-2">
              <p className="text-sm font-bold text-gray-900">{i.name ?? "Sans nom"}</p>
              {i.accroche && <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-2">{i.accroche}</p>}
            </div>
          ))}
          {/* Dire ce qui est possible et ce qui ne l'est pas. Une mise en relation exige deux
              annonces à apparier : sans recherche de leur côté, le produit ne peut pas la
              créer. Laisser croire l'inverse serait pire que le silence d'avant. */}
          <p className="text-[11px] leading-snug text-amber-800/90">
            {/* « ont vu » sous-disait le geste : cette liste se construit sur des swipes
                « Intéressé », jamais sur des vues — c'était déjà le cas avant que le signal des
                sections 223-224 ne s'y aligne. Un affichage ne doit pas nommer un fait plus
                faible que celui qui s'est produit. */}
            Ces personnes se sont signalées sur votre annonce. Une mise en relation n&apos;est pas
            encore possible : elle suppose une recherche publiée de leur côté, à apparier avec la
            vôtre. Elles apparaîtront dans le fil dès qu&apos;elles en publieront une.
          </p>
        </div>
      )}
    </div>
  );
}
