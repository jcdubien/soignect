"use client";

import { useState } from "react";

// Assistance IA de la saisie en texte libre, commune à l'annonce (cabinet, établissement) et à
// la disponibilité (candidat). Chaque action = 1 appel serveur explicite, jamais à la frappe.
// Ce qui diffère d'un formulaire à l'autre — le rôle transmis au modèle, la façon d'appliquer
// les champs extraits, les lignes d'aide — est passé par l'appelant.

export type ActionIA = "extract" | "title" | "redaction" | "optimize";

export function useAssistanceIA(o: {
  role: "candidat" | "cabinet" | "employeur";
  texte: string;
  // Informations déjà renseignées — évite que « Qu'est-ce qui manque ? » suggère du déjà-là.
  connus: () => string[];
  // « Rien à ajouter — <dejaComplet> » quand aucune suggestion n'est faite.
  dejaComplet: string;
  appliquer: (fields: Record<string, unknown>) => void;
  ouvrirChamps: () => void;
  poserTitre: (titre: string) => void;
  poserTexte: (texte: string) => void;
}) {
  const [aiBusy, setAiBusy] = useState<null | ActionIA>(null);
  const [aiDegraded, setAiDegraded] = useState(false); // plafond DeepSeek atteint → repli manuel
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [optimizeTips, setOptimizeTips] = useState<string[]>([]);
  const [extractDone, setExtractDone] = useState(false);
  // Texte libre tel qu'il était avant la dernière reformulation — null = rien à annuler.
  const [rawTextBeforeRedaction, setRawTextBeforeRedaction] = useState<string | null>(null);

  async function runAI(action: ActionIA) {
    if (aiBusy) return;
    setAiBusy(action); setAiDegraded(false); setAiNotice(null);
    try {
      const res = await fetch("/api/ai/annonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, role: o.role, text: o.texte,
          ...(action === "optimize" ? { known: o.connus() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.degraded) { setAiDegraded(true); return; }
      if (action === "extract") {
        o.appliquer(data.fields ?? {});
        setExtractDone(true);
        o.ouvrirChamps(); // on ouvre les champs pour vérification/complétion
        const n = Object.keys(data.fields ?? {}).length;
        setAiNotice(n > 0 ? `${n} information${n > 1 ? "s" : ""} détectée${n > 1 ? "s" : ""} — vérifiez ci-dessous.` : "Aucune information exploitable détectée — complétez à la main.");
      } else if (action === "title") {
        if (typeof data.title === "string" && data.title) o.poserTitre(data.title);
      } else if (action === "redaction") {
        if (typeof data.text === "string" && data.text) {
          // Mémorise le texte AVANT écrasement pour rendre la reformulation annulable.
          setRawTextBeforeRedaction(o.texte);
          o.poserTexte(data.text);
        }
      } else if (action === "optimize") {
        setOptimizeTips(Array.isArray(data.suggestions) ? data.suggestions : []);
        if ((data.suggestions ?? []).length === 0) setAiNotice(`Rien à ajouter — ${o.dejaComplet} 👍`);
      }
    } catch {
      setAiDegraded(true);
    } finally {
      setAiBusy(null);
    }
  }

  function annulerReformulation() {
    if (rawTextBeforeRedaction === null) return;
    o.poserTexte(rawTextBeforeRedaction);
    setRawTextBeforeRedaction(null);
  }

  return { aiBusy, aiDegraded, aiNotice, optimizeTips, extractDone, rawTextBeforeRedaction, runAI, annulerReformulation };
}

export function AssistanceIA({
  ia,
  texte,
  disponible,
  aideRemplir,
  aideTitre,
}: {
  ia: ReturnType<typeof useAssistanceIA>;
  texte: string;
  // L'assistance n'existe que là où l'invite est écrite pour la profession (section 294).
  disponible: boolean;
  aideRemplir: string;
  aideTitre: string;
}) {
  const { aiBusy, aiDegraded, aiNotice, optimizeTips, rawTextBeforeRedaction, runAI, annulerReformulation } = ia;
  const texteCourt = texte.trim().length < 10;
  return (
    <>
      {/* Libellés décrivant le RÉSULTAT, pas l'action : « Analyser » et « Optimiser »
          sonnaient pareil et rien n'indiquait lequel modifiait quoi. La ligne d'aide
          sous chacun dit ce qui change : les champs, le texte, ou rien.
          ── L'ASSISTANCE N'EXISTE QUE LÀ OÙ L'INVITE EST ÉCRITE (section 294) ──
          Les invites nomment « kinésithérapeute » : soumises au texte d'un infirmier,
          elles extraient avec la mauvaise grille. On RETIRE les boutons plutôt que de
          les griser — un bouton désactivé invite à chercher ce qui le débloquerait, et
          ici rien ne le débloque. La saisie manuelle n'a jamais dépendu d'eux. */}
      {disponible && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => runAI("extract")} disabled={aiBusy !== null || texteCourt}
          className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl bg-kine-600 text-white hover:bg-kine-700 transition disabled:opacity-40">
          <span className="text-xs font-bold">{aiBusy === "extract" ? "Analyse…" : "✨ Remplir les champs"}</span>
          <span className="text-[10px] font-normal opacity-80 leading-snug">{aideRemplir}</span>
        </button>
        <button type="button" onClick={() => runAI("redaction")} disabled={aiBusy !== null}
          className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl border border-kine-300 text-kine-700 hover:bg-kine-50 transition disabled:opacity-40">
          <span className="text-xs font-bold">{aiBusy === "redaction" ? "Rédaction…" : "✍️ Reformuler mon texte"}</span>
          <span className="text-[10px] font-normal opacity-70 leading-snug">réécrit ci-dessus, vous pourrez annuler</span>
        </button>
        <button type="button" onClick={() => runAI("optimize")} disabled={aiBusy !== null || texteCourt}
          className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl border border-kine-300 text-kine-700 hover:bg-kine-50 transition disabled:opacity-40">
          <span className="text-xs font-bold">{aiBusy === "optimize" ? "Analyse…" : "🚀 Qu'est-ce qui manque ?"}</span>
          <span className="text-[10px] font-normal opacity-70 leading-snug">suggestions d&apos;ajouts, rien n&apos;est modifié</span>
        </button>
        {/* Regroupé avec les autres assistances : il était isolé dans l'encart
            « ce que j'ai compris » et n'apparaissait qu'après extraction. */}
        <button type="button" onClick={() => runAI("title")} disabled={aiBusy !== null || texteCourt}
          className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl border border-kine-300 text-kine-700 hover:bg-kine-50 transition disabled:opacity-40">
          <span className="text-xs font-bold">{aiBusy === "title" ? "Titre…" : "✨ Proposer un titre"}</span>
          <span className="text-[10px] font-normal opacity-70 leading-snug">{aideTitre}</span>
        </button>
      </div>
      )}

      {/* Annulation de la reformulation — seul geste destructif du formulaire : la
          réécriture remplace le texte de l'utilisateur sans confirmation. On garde
          l'ancien en mémoire, un clic le restaure. */}
      {rawTextBeforeRedaction !== null && (
        <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <span className="text-amber-800">Votre texte a été reformulé.</span>
          <button
            type="button"
            onClick={annulerReformulation}
            className="ml-auto shrink-0 font-bold text-amber-900 underline hover:text-amber-950"
          >
            Annuler la reformulation
          </button>
        </div>
      )}

      {aiDegraded && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Assistance IA momentanément indisponible (limite atteinte). Aucun souci : remplissez les champs à la main ci-dessous, la publication reste possible.
        </p>
      )}
      {aiNotice && !aiDegraded && (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">{aiNotice}</p>
      )}
      {optimizeTips.length > 0 && (
        <div className="rounded-xl bg-kine-50 border border-kine-100 px-3 py-2.5">
          <p className="text-[11px] font-bold text-kine-700 uppercase tracking-wide mb-1">Suggestions d&apos;ajout</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {optimizeTips.map((t, i) => <li key={i} className="text-xs text-gray-700">{t}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}
