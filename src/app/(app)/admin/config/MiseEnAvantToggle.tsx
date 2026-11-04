"use client";

import { useState } from "react";

// Toggle admin (étape 6, 04/11) — la mise en avant payante des postes d'établissement joue-t-elle
// dans le fil ? Éteint par défaut : les mises en avant enregistrées dans /admin/missions restent
// sans effet tant qu'il l'est.
export default function MiseEnAvantToggle({ initial }: { initial: boolean }) {
  const [active, setActive] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (saving) return;
    setSaving(true);
    setError("");
    const next = !active;
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ miseEnAvantPosteSalarie: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setActive(data.miseEnAvantPosteSalarie);
    } else {
      setError("Échec de la mise à jour.");
    }
    setSaving(false);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Mise en avant payante des postes salariés</p>
          <p className="text-xs text-gray-500 mt-0.5 max-w-md">
            Actif : un poste d&apos;établissement mis en avant depuis Annonces remonte dans le fil des
            candidats (même plafond et même densité que la priorité territoriale) et porte la
            mention « Mis en avant — payée par … ». Inactif : les mises en avant enregistrées
            n&apos;ont aucun effet.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          role="switch"
          aria-checked={active}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            active ? "bg-amber-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              active ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs font-medium">
        État actuel :{" "}
        <span className={active ? "text-amber-600" : "text-gray-600"}>
          {active ? "Active dans le fil" : "Éteinte (aucun effet)"}
        </span>
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
