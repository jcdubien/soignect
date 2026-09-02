"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Changement de camp en self-service (section 222).
//
// POURQUOI DEUX CAMPS ET NON TROIS TYPES. REMPLACANT et ASSISTANT doivent fusionner en une seule
// catégorie « chercheur » (décision du 26/08). Présenter trois options égales et définitives
// installerait dans l'écran une distinction qu'on a prévu de supprimer — et que l'utilisateur
// devrait comprendre pour rien.

interface Impact {
  campActuel: "TITULAIRE" | "CHERCHEUR";
  campCible: "TITULAIRE" | "CHERCHEUR";
  annoncesADesactiver: number;
  postesConserves: number;
  relationsBloquantes: { id: string; avec: string }[];
}

const NOM_CAMP: Record<"TITULAIRE" | "CHERCHEUR", string> = {
  TITULAIRE: "Titulaire / cabinet",
  CHERCHEUR: "Chercheur de poste",
};

const QUOI_CAMP: Record<"TITULAIRE" | "CHERCHEUR", string> = {
  TITULAIRE: "Vous publiez des postes et disposez du Planning.",
  CHERCHEUR: "Vous publiez vos disponibilités et répondez aux annonces.",
};

export default function ChangementCamp({
  profileId,
  campActuel,
  etaitAssistant,
}: {
  profileId: string;
  campActuel: "TITULAIRE" | "CHERCHEUR";
  /** Sert au seul avertissement sur la sous-catégorie non mémorisée — voir plus bas. */
  etaitAssistant: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [impact, setImpact] = useState<Impact | null>(null);
  const [chargement, setChargement] = useState(false);
  const [bascule, setBascule] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const cible = campActuel === "TITULAIRE" ? "CHERCHEUR" : "TITULAIRE";

  async function ouvrir() {
    if (chargement) return;
    setChargement(true);
    setErreur(null);
    try {
      const r = await fetch(`/api/profiles/${profileId}/type`);
      if (!r.ok) { setErreur("Impossible de vérifier les conséquences. Réessayez."); return; }
      setImpact(await r.json());
    } catch {
      setErreur("Erreur réseau. Réessayez.");
    } finally {
      setChargement(false);
    }
  }

  async function confirmer() {
    if (bascule) return;
    setBascule(true);
    setErreur(null);
    try {
      const r = await fetch(`/api/profiles/${profileId}/type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camp: cible }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErreur(typeof d?.error === "string" ? d.error : "Le changement a échoué. Réessayez.");
        // Le refus peut venir d'une relation née DEPUIS l'aperçu : on le rafraîchit pour que
        // l'écran cesse d'annoncer un basculement possible.
        void ouvrir();
        return;
      }
      // Le jeton porte `profileType`, et les gardes de /planning et /disponibilites le lisent.
      // Sans cette relecture forcée, l'utilisateur serait renvoyé vers l'écran de son ANCIEN camp
      // pendant plusieurs minutes après avoir basculé.
      //
      // L'ARGUMENT `{}` N'EST PAS DÉCORATIF. `update()` SANS argument fait un simple GET —
      // next-auth/react : `typeof data === "undefined" ? undefined : { body: … }`. Seul un appel
      // AVEC données envoie le POST qui vaut `trigger: "update"` côté serveur. Constaté en
      // production le 02/09 : la base passait bien en TITULAIRE, le jeton restait ASSISTANT, et
      // /planning renvoyait vers /annonces.
      await update({});
      router.refresh();
      router.push(cible === "TITULAIRE" ? "/planning" : "/disponibilites");
    } catch {
      setErreur("Erreur réseau. Réessayez.");
    } finally {
      setBascule(false);
    }
  }

  const bloque = (impact?.relationsBloquantes.length ?? 0) > 0;

  return (
    <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Type de profil</h2>

      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
        <p className="text-sm font-semibold text-gray-800">{NOM_CAMP[campActuel]}</p>
        <p className="text-xs text-gray-500 mt-0.5">{QUOI_CAMP[campActuel]}</p>
      </div>

      {!impact && (
        <>
          <button
            type="button"
            onClick={ouvrir}
            disabled={chargement}
            className="md3-ripple w-full py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
          >
            {chargement ? "Vérification…" : `Devenir ${NOM_CAMP[cible].toLowerCase()}`}
          </button>
          <p className="text-[11px] text-gray-400 leading-snug">
            Vous verrez ce que le changement implique avant de le confirmer.
          </p>
        </>
      )}

      {impact && (
        <div className="rounded-xl border border-gray-200 p-3.5 space-y-3">
          <p className="text-sm font-semibold text-gray-800">
            Passer en « {NOM_CAMP[cible]} »
          </p>
          <p className="text-xs text-gray-500">{QUOI_CAMP[cible]}</p>

          {bloque ? (
            /* Refus, pas avertissement : une mise en relation apparie un titulaire et un
               candidat. Après bascule, les deux côtés seraient du même camp, et un contrat
               généré dessus serait faux. */
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <p className="text-xs font-semibold text-red-700">
                Changement impossible pour l&apos;instant
              </p>
              {/* L'accord porte sur TOUTE la phrase, pas seulement sur « mise(s) ». Constaté à
                  l'écran en production : « 1 mise en relation en cours : Bisot. Finalisez-LES ou
                  annulez-LES d'abord. » */}
              <p className="text-[11px] text-red-600 mt-1 leading-snug">
                {impact.relationsBloquantes.length} mise{impact.relationsBloquantes.length > 1 ? "s" : ""} en
                relation en cours&nbsp;: {impact.relationsBloquantes.map((r) => r.avec).join(", ")}.
                {impact.relationsBloquantes.length > 1
                  ? " Finalisez-les ou annulez-les d'abord."
                  : " Finalisez-la ou annulez-la d'abord."}
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs text-gray-600">
              {/* Formulation vérifiée sur un aller-retour réel : revenir NE republie PAS les
                  annonces. Dire « vous les retrouverez » aurait laissé croire le contraire. */}
              {impact.annoncesADesactiver > 0 && (
                <li>
                  <strong>{impact.annoncesADesactiver}</strong> annonce
                  {impact.annoncesADesactiver > 1 ? "s" : ""} en ligne {impact.annoncesADesactiver > 1 ? "seront retirées" : "sera retirée"} du
                  fil. Rien n&apos;est supprimé, mais {impact.annoncesADesactiver > 1 ? "elles resteront retirées" : "elle restera retirée"} même
                  si vous revenez&nbsp;: il faudra {impact.annoncesADesactiver > 1 ? "les republier" : "la republier"}.
                </li>
              )}
              {impact.postesConserves > 0 && (
                <li>
                  <strong>{impact.postesConserves}</strong> poste{impact.postesConserves > 1 ? "s" : ""} de
                  votre Planning {impact.postesConserves > 1 ? "sont conservés" : "est conservé"}, mais
                  vous n&apos;y aurez plus accès tant que vous êtes chercheur.
                </li>
              )}
              {impact.annoncesADesactiver === 0 && impact.postesConserves === 0 && (
                <li>Aucune donnée existante n&apos;est concernée.</li>
              )}
              {/* Conséquence réelle et non mémorisée — annoncée plutôt que subie. */}
              {etaitAssistant && cible === "TITULAIRE" && (
                <li>
                  Votre profil est aujourd&apos;hui « Assistant·e ». En revenant chercheur plus tard,
                  vous serez enregistré comme « Remplaçant·e »&nbsp;: les deux catégories sont
                  appelées à fusionner.
                </li>
              )}
            </ul>
          )}

          {erreur && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erreur}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setImpact(null); setErreur(null); }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={bascule || bloque}
              className="md3-ripple flex-1 py-2.5 bg-[#0B3D5C] text-white rounded-xl text-sm font-bold hover:bg-[#0a3350] transition disabled:opacity-40"
            >
              {bascule ? "Changement…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {!impact && erreur && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erreur}</p>
      )}
    </section>
  );
}
