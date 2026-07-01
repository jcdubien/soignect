"use client";

import { useState } from "react";

interface Props {
  profileId: string;
  initialOverride: number | null;
  initialExpiry: string | null;
  initialScore: number;
  isFounding: boolean;
}

export default function DesirabilitySlider({
  profileId,
  initialOverride,
  initialExpiry,
  initialScore,
  isFounding,
}: Props) {
  const [override, setOverride] = useState<number>(initialOverride ?? initialScore);
  const [expiry, setExpiry] = useState<string>(initialExpiry ? initialExpiry.slice(0, 10) : "");
  const [score, setScore] = useState<number>(initialScore);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/admin/desirability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        desirabilityOverride: override,
        desirabilityExpiry: expiry ? new Date(expiry).toISOString() : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setScore(data.desirabilityScore);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={isFounding ? 10 : override}
          disabled={isFounding}
          onChange={e => setOverride(Number(e.target.value))}
          className="flex-1 accent-kine-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="w-8 text-center text-sm font-bold text-kine-700 tabular-nums">
          {isFounding ? "10" : override}
        </span>
      </div>

      {!isFounding && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:border-kine-400"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 text-xs font-semibold bg-kine-600 text-white rounded-lg hover:bg-kine-700 active:scale-95 transition disabled:opacity-50"
          >
            {saving ? "…" : saved ? "✓" : "Sauvegarder"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400">Score effectif :</span>
        <span className="text-[10px] font-bold text-kine-600">{score}/10</span>
        {isFounding && (
          <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">Fondateur</span>
        )}
      </div>
    </div>
  );
}
