"use client";

import { useState } from "react";

interface AdminWeightSliderProps {
  profileId: string;
  initialWeight: number;
}

export default function AdminWeightSlider({ profileId, initialWeight }: AdminWeightSliderProps) {
  const [weight, setWeight] = useState(initialWeight);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(newWeight: number) {
    setWeight(newWeight);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/profiles/${profileId}/weight`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min="0.5"
        max="3"
        step="0.5"
        value={weight}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="w-24 accent-kine-500"
      />
      <span className="text-xs font-mono w-6 text-gray-600">{weight}</span>
      <button
        onClick={handleSave}
        disabled={saving || weight === initialWeight}
        className="text-xs px-2 py-1 bg-kine-100 text-kine-700 rounded-lg hover:bg-kine-200 transition disabled:opacity-40"
      >
        {saving ? "…" : saved ? "✓" : "Sauv."}
      </button>
    </div>
  );
}
