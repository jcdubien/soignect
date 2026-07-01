"use client";

import { useState, useMemo } from "react";

interface CommuneAPL {
  id: number;
  codeInsee: string;
  commune: string;
  departement: string;
  aplKine: number | null;
  aplInfirmier: number | null;
  aplMedecin: number | null;
  aplSageFemme: number | null;
  aplOrthophoniste: number | null;
  boostKine: number;
  boostInfirmier: number;
  boostMedecin: number;
  boostSageFemme: number;
  boostOrthophoniste: number;
}

export default function AplClient({ initialData }: { initialData: CommuneAPL[] }) {
  const [data, setData] = useState<CommuneAPL[]>(initialData);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<CommuneAPL>>({});
  const [saving, setSaving] = useState(false);

  const departements = useMemo(
    () => Array.from(new Set(data.map((c) => c.departement))).sort(),
    [data]
  );

  const filtered = useMemo(
    () => (filter ? data.filter((c) => c.departement === filter) : data),
    [data, filter]
  );

  function startEdit(c: CommuneAPL) {
    setEditing(c.id);
    setEditForm({
      boostKine: c.boostKine,
      boostInfirmier: c.boostInfirmier,
      boostMedecin: c.boostMedecin,
      boostSageFemme: c.boostSageFemme,
      boostOrthophoniste: c.boostOrthophoniste,
    });
  }

  function cancelEdit() {
    setEditing(null);
    setEditForm({});
  }

  async function saveEdit(id: number) {
    setSaving(true);
    const r = await fetch(`/api/admin/apl/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (r.ok) {
      setData((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...editForm } : c))
      );
      setEditing(null);
      setEditForm({});
    }
    setSaving(false);
  }

  const BOOST_FIELDS: { key: keyof CommuneAPL; label: string }[] = [
    { key: "boostKine", label: "Kiné" },
    { key: "boostInfirmier", label: "Infirmier" },
    { key: "boostMedecin", label: "Médecin" },
    { key: "boostSageFemme", label: "Sage-femme" },
    { key: "boostOrthophoniste", label: "Orthophoniste" },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">
          Données APL{" "}
          <span className="text-sm font-normal text-gray-400">({filtered.length})</span>
        </h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kine-300"
        >
          <option value="">Tous les départements</option>
          {departements.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">INSEE</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Commune</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Dept.</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">APL Kiné</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Boost Kiné</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Boost Inf.</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Boost Méd.</th>
              <th className="px-3 py-3 text-right text-gray-500 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((c) => (
              <>
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-3 py-2.5 text-gray-500 text-xs font-mono">{c.codeInsee}</td>
                  <td className="px-3 py-2.5 text-gray-700 font-medium">{c.commune}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{c.departement}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">
                    {c.aplKine != null ? c.aplKine.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-semibold ${c.boostKine > 0 ? "text-kine-600" : c.boostKine < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {c.boostKine > 0 ? `+${c.boostKine}` : c.boostKine}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-semibold ${c.boostInfirmier > 0 ? "text-kine-600" : c.boostInfirmier < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {c.boostInfirmier > 0 ? `+${c.boostInfirmier}` : c.boostInfirmier}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-semibold ${c.boostMedecin > 0 ? "text-kine-600" : c.boostMedecin < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {c.boostMedecin > 0 ? `+${c.boostMedecin}` : c.boostMedecin}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => (editing === c.id ? cancelEdit() : startEdit(c))}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                    >
                      {editing === c.id ? "Annuler" : "Modifier"}
                    </button>
                  </td>
                </tr>

                {editing === c.id && (
                  <tr key={`${c.id}-edit`} className="bg-gray-50 border-b border-gray-200">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="flex gap-4 flex-wrap items-end">
                        {BOOST_FIELDS.map(({ key, label }) => (
                          <label key={key} className="space-y-1">
                            <span className="text-xs font-medium text-gray-500">Boost {label}</span>
                            <input
                              type="number"
                              min={-10}
                              max={10}
                              value={(editForm as Record<string, number>)[key] ?? 0}
                              onChange={(e) =>
                                setEditForm({ ...editForm, [key]: parseInt(e.target.value, 10) })
                              }
                              className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                            />
                          </label>
                        ))}
                        <button
                          onClick={() => saveEdit(c.id)}
                          disabled={saving}
                          className="text-sm px-4 py-1.5 bg-kine-600 text-white rounded-lg font-semibold hover:bg-kine-700 disabled:opacity-50 transition"
                        >
                          {saving ? "…" : "Enregistrer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucune commune
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
