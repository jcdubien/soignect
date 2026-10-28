"use client";

import { useState } from "react";
import { ABSENCE_OPTIONS } from "./modele";

// ── Formulaire déclaration d'absence ──────────────────────────────────────────

export function DeclareAbsenceForm({ suggestedStart, suggestedEnd, onClose, onCreated }: {
  suggestedStart: string;
  suggestedEnd: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [absenceType, setAbsenceType] = useState("ABSENT_CONGE");
  const [startDate, setStartDate]     = useState(suggestedStart);
  const [endDate, setEndDate]         = useState(suggestedEnd);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const selected = ABSENCE_OPTIONS.find(o => o.value === absenceType) ?? ABSENCE_OPTIONS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        absenceType: selected.briqueStatus,
        title: selected.label,
        startDate,
        endDate,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Erreur lors de la création.");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold mb-2">VACANCE</span>
        <h3 className="font-bold text-gray-900">Déclarer une absence</h3>
        <p className="text-xs text-gray-500 mt-0.5">La période sera marquée NON COUVERTE jusqu&apos;à trouver un remplaçant.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Type d&apos;absence</label>
        <select
          value={absenceType}
          onChange={e => setAbsenceType(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        >
          {ABSENCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Date de début</label>
        <input
          type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Date de fin</label>
        <input
          type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
        {startDate && endDate && endDate < startDate && (
          <p className="text-[11px] text-red-500 mt-1">La date de fin doit être après la date de début.</p>
        )}
      </div>
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">
          Annuler
        </button>
        <button type="submit" disabled={loading || (!!startDate && !!endDate && endDate < startDate)} className="md3-ripple flex-1 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
          {loading ? "…" : "Valider"}
        </button>
      </div>
    </form>
  );
}

// ── Formulaire ajout poste ─────────────────────────────────────────────────────

export function AddPostForm({ onClose, onCreated, isEmployeur }: { onClose: () => void; onCreated: () => void; isEmployeur: boolean }) {
  const [label, setLabel] = useState("");
  // Défaut selon le type de compte (section 154) : structure = salariat (CDD → ASSISTANT),
  // cabinet libéral = TITULAIRE. isEmployeur ⇔ titulaireKind === STRUCTURE.
  const [postType, setPostType] = useState(isEmployeur ? "ASSISTANT" : "TITULAIRE");
  const [startDate, setStartDate] = useState(""); // date d'occupation, peut être passée
  // Mode de fin d'occupation (section 57) : A=date connue, B=durée prévue, C=indéterminée
  const [finMode, setFinMode] = useState<"A" | "B" | "C">("C");
  const [endDate, setEndDate] = useState("");             // mode A
  const [dureeNum, setDureeNum] = useState("");           // mode B
  const [dureeUnit, setDureeUnit] = useState<"jours" | "semaines" | "mois">("mois"); // mode B
  const [loading, setLoading] = useState(false);

  // Calcule la date de fin effective selon le mode choisi
  function computeEndDate(): string | null {
    if (finMode === "A") return endDate ? new Date(endDate).toISOString() : null;
    if (finMode === "B" && startDate && dureeNum) {
      const n = parseInt(dureeNum, 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      const d = new Date(startDate);
      if (dureeUnit === "jours") d.setDate(d.getDate() + n);
      else if (dureeUnit === "semaines") d.setDate(d.getDate() + n * 7);
      else d.setMonth(d.getMonth() + n);
      return d.toISOString();
    }
    return null; // mode C — durée indéterminée
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/cabinet-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        postType,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: computeEndDate(),
      }),
    });
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="font-bold text-gray-900">Ajouter un poste</h3>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Libellé du poste</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={60}
          required
          placeholder='Ex : "Poste 2", "Dr Marie L."'
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
        <select
          value={postType}
          onChange={e => setPostType(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        >
          {/* Types conditionnels (section 154) : une STRUCTURE (employeur, salariat) n'a pas de
              statuts libéraux → CDD/CDI/Stage/Vacation-Intérim. Les valeurs restent des PostType
              existants (pas de migration) ; seuls les libellés changent.
              Section 5 — "Remplacement ponctuel" retiré (occupation temporaire, pas un type). */}
          {isEmployeur ? (
            <>
              <option value="ASSISTANT">CDD</option>
              <option value="COLLABORATION">CDI</option>
              <option value="ASSOCIE">Stage</option>
              <option value="REMPLACEMENT_REGULIER">Vacation / Intérim</option>
            </>
          ) : (
            <>
              <option value="TITULAIRE">Titulaire</option>
              <option value="ASSOCIE">Associé</option>
              <option value="ASSISTANT">Assistanat (long terme)</option>
              <option value="COLLABORATION">Collaboration libérale</option>
            </>
          )}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Depuis quand ce poste est-il occupé ?
          <span className="text-gray-400 font-normal ml-1">(peut être dans le passé)</span>
        </label>
        {/* Pas de min : la date peut être antérieure à aujourd'hui (section 56) */}
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Comment se termine cette occupation ?</label>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-2">
          {([
            ["A", "Date connue"],
            ["B", "Durée prévue"],
            ["C", "Indéterminée"],
          ] as const).map(([m, lbl]) => (
            <button
              key={m}
              type="button"
              onClick={() => setFinMode(m)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                finMode === m ? "bg-white text-kine-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Mode A — date de fin connue */}
        {finMode === "A" && (
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={e => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
          />
        )}

        {/* Mode B — durée prévue → calcule la date de fin */}
        {finMode === "B" && (
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={dureeNum}
              onChange={e => setDureeNum(e.target.value)}
              placeholder="6"
              className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            />
            <select
              value={dureeUnit}
              onChange={e => setDureeUnit(e.target.value as "jours" | "semaines" | "mois")}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            >
              <option value="jours">jours</option>
              <option value="semaines">semaines</option>
              <option value="mois">mois</option>
            </select>
          </div>
        )}

        {/* Mode C — durée indéterminée */}
        {finMode === "C" && (
          <p className="text-xs text-gray-400 leading-snug">
            Pas de date de fin. La brique reste confirmée ; vous pourrez poser un préavis plus tard en cliquant dessus.
          </p>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Annuler</button>
        <button type="submit" disabled={loading || !label.trim()} className="md3-ripple flex-1 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
          {loading ? "…" : "Créer"}
        </button>
      </div>
    </form>
  );
}
