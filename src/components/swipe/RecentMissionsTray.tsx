"use client";

import { useEffect, useState } from "react";

export interface RecentMission {
  id: string;
  title: string;
  location: string;
  description?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  specialties?: string[];
  profile: { type: string; name: string | null };
}

export const RECENT_KEY = "soignect_recent_missions";
const MAX_RECENT = 5;

export function trackRecentMission(mission: RecentMission) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const existing: RecentMission[] = raw ? JSON.parse(raw) : [];
    // Dédoublonner et mettre en tête
    const updated = [
      mission,
      ...existing.filter(m => m.id !== mission.id),
    ].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch { /* silencieux */ }
}

// Retire une annonce de l'historique (ex. annonce supprimée → /card 404). Dispatche un
// event storage pour rafraîchir la bande dans l'onglet courant.
export function removeRecentMission(id: string) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: RecentMission[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.filter((m) => m.id !== id)));
    window.dispatchEvent(new StorageEvent("storage", { key: RECENT_KEY }));
  } catch { /* silencieux */ }
}

interface Props {
  onSelectMission: (mission: RecentMission) => void;
}

export default function RecentMissionsTray({ onSelectMission }: Props) {
  const [recent, setRecent] = useState<RecentMission[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch { /* silencieux */ }

    // Sync si localStorage change dans un autre onglet
    const handler = () => {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        setRecent(raw ? JSON.parse(raw) : []);
      } catch { /* silencieux */ }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (recent.length === 0) return null;

  const typeEmoji = { TITULAIRE: "🏥", REMPLACANT: "🩺", ASSISTANT: "👩‍⚕️" } as const;

  return (
    <div className="bg-white border-b border-gray-100 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
        Dernières annonces consultées
      </p>
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {recent.map(mission => (
          <button
            key={mission.id}
            onClick={() => onSelectMission(mission)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-kine-50 border border-gray-200 hover:border-kine-200 rounded-xl transition text-left max-w-[180px]"
          >
            <span className="text-sm shrink-0">
              {typeEmoji[mission.profile.type as keyof typeof typeEmoji] ?? "👤"}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate leading-tight">{mission.title}</p>
              <p className="text-[10px] text-gray-400 truncate">{mission.location}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
