"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Annule un pass : même route que « Annuler ce choix » sur la fiche (section 218) — DELETE
// /api/swipe, qui efface la ligne quelle qu'en soit la direction.
export default function RemettreDansLeFil({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [etat, setEtat] = useState<"repos" | "envoi" | "fait" | "erreur">("repos");

  async function remettre() {
    setEtat("envoi");
    try {
      const r = await fetch(`/api/swipe?missionId=${encodeURIComponent(missionId)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setEtat("fait");
      router.refresh();
    } catch {
      setEtat("erreur");
    }
  }

  if (etat === "fait") return <span className="shrink-0 text-xs font-semibold text-emerald-700">De retour dans votre fil</span>;
  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={remettre}
        disabled={etat === "envoi"}
        className="text-xs px-3 py-1.5 rounded-lg border border-kine-200 text-kine-700 font-semibold hover:bg-kine-50 disabled:opacity-50 transition"
      >
        {etat === "envoi" ? "Envoi…" : "Remettre dans mon fil"}
      </button>
      {etat === "erreur" && <p className="text-[11px] text-red-600 mt-1 mb-0">Échec — réessayez.</p>}
    </div>
  );
}
