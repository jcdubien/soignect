"use client";

import { ZONE_ORDER, ZONE_LABELS, type ZoneGeo } from "@/lib/communes";

// Sélecteur multi-zones géographiques (section 138). Chips toggle : plusieurs zones
// activables (ex: « Nord Basse-Terre » + « Sud Basse-Terre » pour couvrir toute la
// Basse-Terre). Vient en complément de la commune précise (ancre), pas en remplacement.
export default function ZoneSelector({
  value,
  onChange,
  label = "Zones géographiques souhaitées",
  hint = "Une annonce située dans l'une de ces zones sera considérée comme une bonne correspondance géographique.",
}: {
  value: ZoneGeo[];
  onChange: (zones: ZoneGeo[]) => void;
  label?: string;
  hint?: string;
}) {
  function toggle(z: ZoneGeo) {
    onChange(value.includes(z) ? value.filter((v) => v !== z) : [...value, z]);
  }

  // « Toute la Guadeloupe » = les 10 zones cochées (section 148) → aucune restriction géo.
  const allSelected = value.length === ZONE_ORDER.length;
  function toggleAll() {
    onChange(allSelected ? [] : [...ZONE_ORDER]);
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleAll}
          aria-pressed={allSelected}
          className={`px-3 py-1.5 rounded-full text-sm font-bold border transition ${
            allSelected
              ? "bg-kine-700 text-white border-kine-700"
              : "bg-kine-50 text-kine-700 border-kine-200 hover:border-kine-400"
          }`}
        >
          🌴 Toute la Guadeloupe
        </button>
        {ZONE_ORDER.map((z) => {
          const active = value.includes(z);
          return (
            <button
              key={z}
              type="button"
              onClick={() => toggle(z)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                active
                  ? "bg-kine-600 text-white border-kine-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-kine-300"
              }`}
            >
              {ZONE_LABELS[z]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
    </div>
  );
}
