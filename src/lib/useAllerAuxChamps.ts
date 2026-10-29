"use client";

import { useEffect, useRef } from "react";

// Bouton d'envoi à DEUX ÉTATS plutôt qu'un grisé silencieux, commun à l'annonce et à la
// disponibilité. Tant qu'il manque quelque chose, il reste ACTIF et conduit aux champs à remplir —
// sur mobile il les révèle, puis fait défiler jusqu'à eux. Un bouton désactivé est une impasse :
// il dit « non » sans dire où aller, alors que le geste attendu est justement d'ouvrir des champs
// qui, sur mobile, sont masqués. Il ne devient « Publier » que quand la fiche est complète.
export function useAllerAuxChamps(showManual: boolean, setShowManual: (v: boolean) => void) {
  const blocChampsRef = useRef<HTMLDivElement | null>(null);
  const scrollDemande = useRef(false);

  // On calcule la position et on pilote la FENÊTRE, au lieu d'appeler scrollIntoView sur le
  // bloc. Mesuré en conditions réelles (fenêtre 500x457) : les champs se révélaient bien à
  // 1038 px, et scrollIntoView ne déplaçait rien — il échoue en silence dès qu'un ancêtre porte
  // un overflow ou une transformation, sans erreur ni avertissement. window.scrollTo sur un
  // offset absolu ne dépend d'aucun ancêtre.
  //
  // Deux rAF : le premier laisse React peindre le bloc révélé, le second garantit que la mise
  // en page est calculée avant qu'on lise sa position — sinon on mesure un bloc encore masqué.
  function scrollVersChamps() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = blocChampsRef.current;
        if (!el) return;
        // DÉFILEMENT INSTANTANÉ, PAS FLUIDE. `behavior: "smooth"` est purement IGNORÉ quand
        // l'utilisateur a activé la réduction des animations — mesuré : scrollTo à 500 px rend
        // 500 en "auto" et 0 en "smooth", sur la même page. Le bouton ne faisait donc rien du
        // tout pour ces utilisateurs, en silence. Aller droit au but est de toute façon le bon
        // geste ici : on a demandé à être emmené quelque part, pas à regarder un travelling.
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "auto" });
      }),
    );
  }
  function allerAuxChamps() {
    // Champs déjà ouverts : on défile tout de suite. Sans ce cas, un second appui ne faisait
    // rien — l'effet ci-dessous ne se déclenche que quand showManual CHANGE.
    if (showManual) { scrollVersChamps(); return; }
    scrollDemande.current = true;
    setShowManual(true);
  }
  useEffect(() => {
    if (!showManual || !scrollDemande.current) return;
    scrollDemande.current = false;
    scrollVersChamps();
  }, [showManual]);

  return { blocChampsRef, allerAuxChamps };
}
