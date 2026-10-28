"use client";

import { useState } from "react";
import Button from "@/components/ui/md3/Button";
import { MissionData, toDate } from "./modele";

// ── FORMULAIRE DE PÉRIODE (section 266, extrait du menu de poste) ────────────────────────────
//
// Il vivait en état local de `PostMenu`, initialisé une fois pour la mission du menu. Deux
// conséquences : il ne pouvait modifier QUE celle-là, et il n'était offert que sur une brique
// SANS annonce active — donc jamais sur une annonce en ligne, qui est pourtant le cas où l'on
// veut le plus souvent décaler trois jours sans rouvrir l'édition complète.
//
// Extrait en composant, il prend sa cible en propriété et repart de ses valeurs à chaque montage.
export function FormulairePeriode({
  mission, onRetour, onDone,
}: { mission: MissionData; onRetour: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [eName, setEName] = useState(mission.title ?? "");
  const [eStart, setEStart] = useState(toDate(mission.startDate)?.toISOString().slice(0, 10) ?? "");
  const [eFinMode, setEFinMode] = useState<"A" | "B" | "C">(toDate(mission.endDate) ? "A" : "C");
  const [eEnd, setEEnd] = useState(toDate(mission.endDate)?.toISOString().slice(0, 10) ?? "");
  const [eDureeNum, setEDureeNum] = useState("");
  const [eDureeUnit, setEDureeUnit] = useState<"jours" | "semaines" | "mois">("mois");

  function computeEnd(): string | null {
    if (eFinMode === "A") return eEnd ? new Date(eEnd).toISOString() : null;
    if (eFinMode === "B" && eStart && eDureeNum) {
      const n = parseInt(eDureeNum, 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      const d = new Date(eStart);
      if (eDureeUnit === "jours") d.setDate(d.getDate() + n);
      else if (eDureeUnit === "semaines") d.setDate(d.getDate() + n * 7);
      else d.setMonth(d.getMonth() + n);
      return d.toISOString();
    }
    return null;
  }

  async function submit() {
    if (!eStart || busy) return;
    setBusy(true);
    const title = eName.trim();
    await fetch(`/api/missions/${mission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(title.length >= 3 ? { title } : {}),
        startDate: new Date(eStart).toISOString(),
        endDate: computeEnd(),
      }),
    });
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nom / praticien</label>
        <input
          type="text" value={eName} onChange={e => setEName(e.target.value)} maxLength={100}
          placeholder="Ex : Dr Marion L."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Date de début</label>
        <input
          type="date" value={eStart} onChange={e => setEStart(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Fin</label>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-2">
          {([["A", "Date connue"], ["B", "Durée"], ["C", "Indéterminée"]] as const).map(([m, lbl]) => (
            <button key={m} type="button" onClick={() => setEFinMode(m)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition ${eFinMode === m ? "bg-white text-kine-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {lbl}
            </button>
          ))}
        </div>
        {eFinMode === "A" && (
          <input type="date" value={eEnd} min={eStart || undefined} onChange={e => setEEnd(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400" />
        )}
        {eFinMode === "B" && (
          <div className="flex gap-2">
            <input type="number" min={1} value={eDureeNum} onChange={e => setEDureeNum(e.target.value)} placeholder="6"
              className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400" />
            <select value={eDureeUnit} onChange={e => setEDureeUnit(e.target.value as "jours" | "semaines" | "mois")}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400">
              <option value="jours">jours</option>
              <option value="semaines">semaines</option>
              <option value="mois">mois</option>
            </select>
          </div>
        )}
        {eFinMode === "C" && <p className="text-xs text-gray-400">Durée indéterminée (pas de date de fin).</p>}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outlined" onClick={onRetour} className="flex-1 !py-2.5">Retour</Button>
        <Button onClick={submit} disabled={!eStart || busy} className="flex-1 !py-2.5">
          {busy ? "…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
