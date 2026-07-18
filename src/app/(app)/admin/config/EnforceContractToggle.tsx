"use client";

import { useState } from "react";

// Toggle admin (section 150) — active le blocage dur des contrats si identité contractuelle
// incomplète. false = phase d'avertissement (non bloquant). À basculer une fois que les
// comptes ont eu le temps de compléter leur profil.
export default function EnforceContractToggle({ initial }: { initial: boolean }) {
  const [enforce, setEnforce] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (saving) return;
    setSaving(true);
    setError("");
    const next = !enforce;
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enforceContractProfile: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setEnforce(data.enforceContractProfile);
    } else {
      setError("Échec de la mise à jour.");
    }
    setSaving(false);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Blocage contrat si profil incomplet</p>
          <p className="text-xs text-gray-500 mt-0.5 max-w-md">
            Actif : accès au contrat refusé tant qu&apos;une des deux parties n&apos;a pas renseigné
            son identité contractuelle (RPPS / N° Ordre / adresse, ou SIRET / adresse pour les
            structures). Inactif : simple avertissement, le PDF affiche « à compléter ».
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          role="switch"
          aria-checked={enforce}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            enforce ? "bg-amber-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enforce ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs font-medium">
        État actuel :{" "}
        <span className={enforce ? "text-amber-600" : "text-gray-600"}>
          {enforce ? "Blocage dur actif" : "Avertissement (non bloquant)"}
        </span>
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
