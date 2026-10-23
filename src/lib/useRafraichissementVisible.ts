"use client";

import { useEffect } from "react";

// Rafraîchissement périodique EN PAUSE quand l'onglet est caché (23/10, relevé Vercel).
//
// La cloche (60 s) et la conversation ouverte (3 s) interrogeaient le serveur sans fin, onglet
// caché compris : dans les journaux, un onglet oublié appelait /api/notifications chaque minute,
// et une conversation laissée ouverte coûtait 1 200 appels par heure. Rien de cela n'est vu.
//
// Le comportement visible ne change pas : au retour sur l'onglet, `charger` part tout de suite,
// puis reprend son rythme. Une seule règle pour les deux, pour qu'elles ne divergent pas.
export function useRafraichissementVisible(charger: () => void, intervalleMs: number): void {
  useEffect(() => {
    let minuterie: ReturnType<typeof setInterval> | null = null;
    const arreter = () => {
      if (minuterie !== null) clearInterval(minuterie);
      minuterie = null;
    };
    const demarrer = () => {
      arreter();
      minuterie = setInterval(charger, intervalleMs);
    };
    const surChangement = () => {
      if (document.visibilityState === "visible") {
        charger();
        demarrer();
      } else {
        arreter();
      }
    };
    if (document.visibilityState === "visible") demarrer();
    document.addEventListener("visibilitychange", surChangement);
    return () => {
      arreter();
      document.removeEventListener("visibilitychange", surChangement);
    };
  }, [charger, intervalleMs]);
}
