"use client";

import { useState } from "react";

export default function ConfigToggle({ initial }: { initial: boolean }) {
  const [freeMode, setFreeMode] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (saving) return;
    setSaving(true);
    setError("");
    const next = !freeMode;
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeAccessMode: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setFreeMode(data.freeAccessMode);
    } else {
      setError("Échec de la mise à jour.");
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Mode lancement gratuit</p>
          <p className="text-xs text-gray-500 mt-0.5 max-w-md">
            Actif : tous les comptes ont accès aux fonctionnalités Premium/Boost, quel que soit
            leur abonnement. Inactif : les fonctionnalités sont de nouveau réservées aux abonnés.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          role="switch"
          aria-checked={freeMode}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            freeMode ? "bg-emerald-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              freeMode ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs font-medium">
        État actuel :{" "}
        <span className={freeMode ? "text-emerald-600" : "text-gray-600"}>
          {freeMode ? "Gratuit pour tous (Premium débloqué)" : "Payant (gates actives selon le plan)"}
        </span>
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
