"use client";

import { useState } from "react";

interface Profile {
  id: string;
  name: string | null;
  type: string;
  profession: string;
  region: string;
  subscriptionPlan: string;
  isVerified: boolean;
  isFounding: boolean;
  institutionalPartner: boolean;
  isActive: boolean;
  desirabilityScore: number;
  desirabilityOverride: number | null;
  desirabilityExpiry: string | null;
  weight: number;
  createdAt: string;
  user: { email: string };
  _count: { missions: number };
}

const TYPE_LABEL: Record<string, string> = {
  REMPLACANT: "Remplaçant",
  ASSISTANT: "Assistant",
  TITULAIRE: "Cabinet",
};

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-500",
  PREMIUM: "bg-kine-100 text-kine-700",
  BOOST: "bg-orange-100 text-orange-700",
};

export default function ProfilesClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});

  function startEdit(p: Profile) {
    setEditing(p.id);
    setForm({
      type: p.type,
      subscriptionPlan: p.subscriptionPlan,
      isVerified: p.isVerified,
      isFounding: p.isFounding,
      institutionalPartner: p.institutionalPartner,
      isActive: p.isActive,
      desirabilityScore: p.desirabilityScore,
      desirabilityOverride: p.desirabilityOverride,
      desirabilityExpiry: p.desirabilityExpiry,
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({});
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const r = await fetch(`/api/admin/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        subscriptionPlan: form.subscriptionPlan,
        isVerified: form.isVerified,
        isFounding: form.isFounding,
        institutionalPartner: form.institutionalPartner,
        isActive: form.isActive,
        desirabilityScore: form.desirabilityScore,
        desirabilityOverride: form.desirabilityOverride ?? null,
        desirabilityExpiry: form.desirabilityExpiry ?? null,
      }),
    });
    if (r.ok) {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                type: (form.type ?? p.type) as string,
                subscriptionPlan: (form.subscriptionPlan ?? p.subscriptionPlan) as string,
                isVerified: form.isVerified ?? p.isVerified,
                isFounding: form.isFounding ?? p.isFounding,
                institutionalPartner: form.institutionalPartner ?? p.institutionalPartner,
                isActive: form.isActive ?? p.isActive,
                desirabilityScore: form.desirabilityScore ?? p.desirabilityScore,
                desirabilityOverride: form.desirabilityOverride ?? p.desirabilityOverride,
                desirabilityExpiry: form.desirabilityExpiry ?? p.desirabilityExpiry,
              }
            : p
        )
      );
      setEditing(null);
      setForm({});
    }
    setSaving(false);
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">
        Profils{" "}
        <span className="text-sm font-normal text-gray-400">({profiles.length})</span>
      </h1>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Email / Nom</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Type</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Plan</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Désir.</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Annonces</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Flags</th>
              <th className="px-3 py-3 text-right text-gray-500 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles.map((p) => (
              <>
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-3 py-3">
                    <p className="text-gray-700 font-medium truncate max-w-[200px]">{p.user.email}</p>
                    {p.name && (
                      <p className="text-gray-400 text-xs truncate max-w-[200px]">{p.name}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.type === "REMPLACANT"
                          ? "bg-blue-100 text-blue-700"
                          : p.type === "ASSISTANT"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {TYPE_LABEL[p.type] ?? p.type}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[p.subscriptionPlan]}`}>
                      {p.subscriptionPlan}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-kine-600">
                      {p.desirabilityOverride != null
                        ? p.desirabilityOverride.toFixed(1)
                        : p.desirabilityScore.toFixed(1)}
                    </span>
                    <span className="text-gray-300 text-xs">/10</span>
                  </td>
                  <td className="px-3 py-3 text-gray-500">{p._count.missions}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.isVerified && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                          Vérifié
                        </span>
                      )}
                      {p.isFounding && (
                        <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-medium">
                          Fondateur
                        </span>
                      )}
                      {!p.isActive && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                          Inactif
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => (editing === p.id ? cancelEdit() : startEdit(p))}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                    >
                      {editing === p.id ? "Annuler" : "Modifier"}
                    </button>
                  </td>
                </tr>

                {editing === p.id && (
                  <tr key={`${p.id}-edit`} className="bg-gray-50 border-b border-gray-200">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <label className="space-y-1">
                          <span className="text-xs font-medium text-gray-500">Type</span>
                          <select
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                          >
                            <option value="REMPLACANT">Remplaçant</option>
                            <option value="ASSISTANT">Assistant</option>
                            <option value="TITULAIRE">Cabinet</option>
                          </select>
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs font-medium text-gray-500">Plan</span>
                          <select
                            value={form.subscriptionPlan}
                            onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                          >
                            <option value="FREE">FREE</option>
                            <option value="PREMIUM">PREMIUM</option>
                            <option value="BOOST">BOOST</option>
                          </select>
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs font-medium text-gray-500">
                            Score désirabilité (0-10)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.5}
                            value={form.desirabilityScore}
                            onChange={(e) =>
                              setForm({ ...form, desirabilityScore: parseFloat(e.target.value) })
                            }
                            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs font-medium text-gray-500">Override (0-10)</span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.5}
                            value={form.desirabilityOverride ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                desirabilityOverride: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            placeholder="—"
                            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs font-medium text-gray-500">Expiry override</span>
                          <input
                            type="date"
                            value={form.desirabilityExpiry ? form.desirabilityExpiry.split("T")[0] : ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                desirabilityExpiry: e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : null,
                              })
                            }
                            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                          />
                        </label>

                        <div className="space-y-1">
                          <span className="text-xs font-medium text-gray-500">Flags</span>
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.isVerified}
                                onChange={(e) => setForm({ ...form, isVerified: e.target.checked })}
                              />
                              Vérifié RPPS
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.isFounding}
                                onChange={(e) => setForm({ ...form, isFounding: e.target.checked })}
                              />
                              Cabinet fondateur
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.institutionalPartner}
                                onChange={(e) => setForm({ ...form, institutionalPartner: e.target.checked })}
                              />
                              Partenaire CPTS (Premium gratuit + boost)
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                              />
                              Profil actif
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={saving}
                          className="text-sm px-4 py-2 bg-kine-600 text-white rounded-lg font-semibold hover:bg-kine-700 disabled:opacity-50 transition"
                        >
                          {saving ? "Sauvegarde…" : "Enregistrer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucun profil
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
