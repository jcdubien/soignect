"use client";

import { useEffect, useRef, useState } from "react";

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

// Historique cloisonné PAR COMPTE (profileId). Sans ça, changer de compte dans le même
// navigateur faisait hériter de l'historique d'un autre compte (ex. voir ses propres
// annonces, vues sous un compte remplaçant). L'ancienne clé non cloisonnée est nettoyée.
const LEGACY_KEY = "soignect_recent_missions";
const MAX_RECENT = 5;

function recentKey(profileId?: string | null): string {
  return `soignect_recent_missions_${profileId || "anon"}`;
}

export function trackRecentMission(mission: RecentMission, profileId?: string | null) {
  try {
    const key = recentKey(profileId);
    const raw = localStorage.getItem(key);
    const existing: RecentMission[] = raw ? JSON.parse(raw) : [];
    // Dédoublonner et mettre en tête
    const updated = [
      mission,
      ...existing.filter(m => m.id !== mission.id),
    ].slice(0, MAX_RECENT);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch { /* silencieux */ }
}

// Retire une annonce de l'historique (ex. annonce supprimée → /card 404). Dispatche un
// event storage pour rafraîchir la bande dans l'onglet courant.
export function removeRecentMission(id: string, profileId?: string | null) {
  try {
    const key = recentKey(profileId);
    const raw = localStorage.getItem(key);
    const list: RecentMission[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(key, JSON.stringify(list.filter((m) => m.id !== id)));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  } catch { /* silencieux */ }
}

interface Props {
  onSelectMission: (mission: RecentMission) => void;
  profileId?: string | null;
}

export default function RecentMissionsTray({ onSelectMission, profileId }: Props) {
  const [recent, setRecent] = useState<RecentMission[]>([]);
  // Évite de revalider en boucle le même jeu d'ids (signature déjà vérifiée).
  const checkedSig = useRef("");

  useEffect(() => {
    // Nettoyage unique de l'ancienne clé non cloisonnée (pollution inter-comptes).
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* silencieux */ }

    const key = recentKey(profileId);
    const read = () => {
      try {
        const raw = localStorage.getItem(key);
        setRecent(raw ? JSON.parse(raw) : []);
      } catch { setRecent([]); }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [profileId]);

  // Masque (et purge) les annonces devenues INACTIVES/supprimées : l'historique est un cache
  // localStorage qui ignore le statut serveur. Vérification légère sans effet de bord.
  useEffect(() => {
    const ids = recent.map((m) => m.id);
    const sig = ids.join(",");
    if (ids.length === 0 || sig === checkedSig.current) return;
    checkedSig.current = sig;
    let cancelled = false;
    fetch("/api/missions/active-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !Array.isArray(d?.activeIds)) return;
        const active = new Set(d.activeIds as string[]);
        const filtered = recent.filter((m) => active.has(m.id));
        if (filtered.length === recent.length) return; // rien d'inactif
        checkedSig.current = filtered.map((m) => m.id).join(","); // évite un re-check inutile
        try { localStorage.setItem(recentKey(profileId), JSON.stringify(filtered)); } catch { /* silencieux */ }
        setRecent(filtered);
      })
      .catch(() => { /* réseau KO : on garde l'historique tel quel */ });
    return () => { cancelled = true; };
  }, [recent, profileId]);

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
