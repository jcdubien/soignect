"use client";

import { useState } from "react";

interface Mission {
  id: string;
  title: string;
  location: string;
  missionType: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  profile: {
    id: string;
    name: string | null;
    type: string;
    user: { email: string };
  };
}

const TYPE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat",
  COLLABORATION: "Collaboration",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
}

export default function MissionsClient({ initialMissions }: { initialMissions: Mission[] }) {
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [loading, setLoading] = useState<string | null>(null);

  async function toggleActive(m: Mission) {
    setLoading(m.id);
    const r = await fetch(`/api/admin/missions/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    if (r.ok) {
      setMissions((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, isActive: !m.isActive } : x))
      );
    }
    setLoading(null);
  }

  async function deleteMission(m: Mission) {
    if (!confirm(`Supprimer définitivement "${m.title}" ?`)) return;
    setLoading(m.id);
    const r = await fetch(`/api/admin/missions/${m.id}`, { method: "DELETE" });
    if (r.ok) {
      setMissions((prev) => prev.filter((x) => x.id !== m.id));
    }
    setLoading(null);
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">
        Annonces{" "}
        <span className="text-sm font-normal text-gray-400">({missions.length})</span>
      </h1>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Titre / Cabinet</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Lieu</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Type</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Dates</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Statut</th>
              <th className="px-3 py-3 text-right text-gray-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {missions.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition">
                <td className="px-3 py-3">
                  <p className="text-gray-700 font-medium truncate max-w-[200px]">{m.title}</p>
                  <p className="text-gray-400 text-xs truncate max-w-[200px]">
                    {m.profile.name ?? m.profile.user.email}
                  </p>
                </td>
                <td className="px-3 py-3 text-gray-500 text-xs">{m.location}</td>
                <td className="px-3 py-3">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {TYPE_LABEL[m.missionType] ?? m.missionType}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {m.startDate ? `${fmtDate(m.startDate)} → ${fmtDate(m.endDate)}` : "—"}
                </td>
                <td className="px-3 py-3">
                  {m.isActive ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                      Actif
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                      Inactif
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => toggleActive(m)}
                      disabled={loading === m.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      {m.isActive ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      onClick={() => deleteMission(m)}
                      disabled={loading === m.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {missions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucune annonce
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
