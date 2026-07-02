"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Mission, Profile } from "@prisma/client";
import { getInitials, getInitialsColor } from "@/components/ui/PhotoUpload";

type MissionWithProfile = Mission & { profile: Profile };

interface TrayItem {
  mission: MissionWithProfile;
  affinityScore:    number | null;
  scoreDetails:     Record<string, number> | null;
  matchId:          string | null;
  aiScore:          number | null;
  contratConfirmed: boolean;
}

interface MatchTrayProps {
  /** Incrémenté par le parent après chaque swipe RIGHT pour forcer un refetch */
  refreshKey?: number;
}

// ── Fiche complète de l'annonce ───────────────────────────────────────────────
function MissionSheet({
  item, onClose, onCancelled,
}: {
  item: TrayItem;
  onClose: () => void;
  onCancelled: (matchId: string) => void;
}) {
  const { mission } = item;
  const p = mission.profile;

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Annulation possible uniquement si un match existe et n'est pas confirmé (section 48)
  const canCancel = !!item.matchId && !item.contratConfirmed;

  async function handleCancel() {
    if (!item.matchId || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/match/${item.matchId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("L'annulation a échoué. Réessayez.");
        setCancelling(false);
        return;
      }
      onCancelled(item.matchId);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setCancelling(false);
    }
  }

  const bioText = (mission as MissionWithProfile & { bioTinder?: string | null }).bioTinder ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        <div className="px-6 py-5">
          {/* En-tête */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{mission.title}</h2>
              <p className="text-sm text-gray-400 mt-0.5">📍 {mission.location}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Score affinité */}
          {item.affinityScore !== null && (
            <div className="mb-4 p-3.5 bg-kine-50 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-kine-700">Score d&apos;affinité</span>
                <span className="text-xl font-black text-kine-600">{Math.round(item.affinityScore)}<span className="text-sm font-normal text-kine-400">/100</span></span>
              </div>
              <div className="w-full bg-kine-100 rounded-full h-2 mb-2">
                <div
                  className="bg-kine-500 h-2 rounded-full"
                  style={{ width: `${Math.min(item.affinityScore, 100)}%` }}
                />
              </div>
              {/* Détail des composantes */}
              {item.scoreDetails && (
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {[
                    { key: "dates",        label: "Dates",      max: 30 },
                    { key: "geo",          label: "Lieu",       max: 20 },
                    { key: "specialty",    label: "Spécialités",max: 20 },
                    { key: "bio",          label: "Affinité",   max: 20 },
                    { key: "desirability", label: "Visibilité", max: 10 },
                  ].map(({ key, label, max }) => {
                    const val = item.scoreDetails?.[key] ?? 0;
                    return (
                      <div key={key} className="flex flex-col items-center bg-white rounded-xl p-1.5">
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</span>
                        <span className="text-sm font-bold text-kine-600">{val}<span className="text-[9px] text-gray-300">/{max}</span></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Match badge */}
          {item.matchId && (
            <div className="mb-4 p-3 bg-emerald-50 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-emerald-700 font-semibold text-sm">🎉 C&apos;est une mise en relation !</p>
                <p className="text-emerald-500 text-xs mt-0.5">Vous pouvez entrer en contact</p>
              </div>
              <a
                href="/matches"
                className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition"
              >
                Discuter →
              </a>
            </div>
          )}

          {/* Bio Tinder */}
          {bioText && (
            <p className="text-kine-700 text-sm italic border-l-2 border-kine-400 pl-3 mb-3 bg-kine-50 rounded-r-xl py-2 pr-2">
              {bioText}
            </p>
          )}

          {/* Description */}
          {mission.description && (
            <p className="text-gray-600 text-sm mb-3">{mission.description}</p>
          )}

          {/* Dates */}
          {(mission.startDate || mission.minMonths) && (
            <div className="flex flex-col gap-1.5 mb-3">
              {mission.startDate && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span>📅</span>
                  <span>
                    {new Date(mission.startDate).toLocaleDateString("fr-FR")}
                    {mission.endDate && ` → ${new Date(mission.endDate).toLocaleDateString("fr-FR")}`}
                  </span>
                </div>
              )}
              {mission.minMonths && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span>⏱</span>
                  <span>{mission.minMonths} mois minimum</span>
                </div>
              )}
            </div>
          )}

          {/* Spécialités */}
          {mission.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {mission.specialties.map(s => (
                <span key={s} className="px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-600">{s}</span>
              ))}
            </div>
          )}

          {/* Profil */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Profil</p>
            {p.bio && <p className="text-sm text-gray-600">{p.bio}</p>}
            {p.ratingCount > 0 && (
              <p className="text-sm text-yellow-600 mt-1 font-medium">★ {p.ratingAvg?.toFixed(1)} <span className="text-gray-400 font-normal">({p.ratingCount} avis)</span></p>
            )}
          </div>

          {/* Annuler la mise en relation — discret, texte rouge sans fond (section 48) */}
          {canCancel && (
            <div className="pt-4 mt-3 border-t border-gray-100 flex justify-center">
              <button
                onClick={() => setConfirming(true)}
                className="text-sm font-semibold text-red-600 hover:text-red-700 hover:underline transition"
              >
                Annuler cette mise en relation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modale de confirmation d'annulation */}
      {confirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/50"
          onClick={(e) => { e.stopPropagation(); if (!cancelling) setConfirming(false); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 text-base mb-2">Annuler cette mise en relation ?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Cette action est irréversible. Vous pourrez retrouver ce profil dans les annonces plus tard.
            </p>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirming(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:opacity-40"
              >
                {cancelling ? "Annulation…" : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MatchTray principal ───────────────────────────────────────────────────────
export default function MatchTray({ refreshKey }: MatchTrayProps) {
  const [items,       setItems]       = useState<TrayItem[]>([]);
  const [selected,    setSelected]    = useState<TrayItem | null>(null);
  const [, setSeenIds] = useState<Set<string>>(new Set());
  const [unreadIds,   setUnreadIds]   = useState<Set<string>>(new Set());
  const prevMatchIdsRef               = useRef<Set<string>>(new Set());

  const fetchTray = useCallback(async () => {
    try {
      const r = await fetch("/api/tray");
      if (!r.ok) return;
      const data: TrayItem[] = await r.json();
      setItems(data);

      // Détecter les nouveaux matchs depuis la dernière récupération
      const currentMatchIds = new Set(data.filter(i => i.matchId).map(i => i.matchId as string));
      const newIds: string[] = [];
      currentMatchIds.forEach(id => {
        if (!prevMatchIdsRef.current.has(id)) newIds.push(id);
      });
      if (newIds.length > 0) {
        setUnreadIds(prev => new Set(Array.from(prev).concat(newIds)));
      }
      prevMatchIdsRef.current = currentMatchIds;
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => { fetchTray(); }, [fetchTray, refreshKey]);

  const matchedItems = items.filter(i => i.matchId);
  const likedItems   = items.filter(i => !i.matchId);
  const sorted = [
    ...matchedItems.sort((a, b) => (b.affinityScore ?? 0) - (a.affinityScore ?? 0)),
    ...likedItems.sort((a, b) => (b.affinityScore ?? 0) - (a.affinityScore ?? 0)),
  ];

  const totalUnread = unreadIds.size;

  if (sorted.length === 0) return null;

  return (
    <>
      <div className="shrink-0 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
        <div className="px-3 pt-2 pb-3" style={{ height: 92 }}>
          {/* Libellé + badge global */}
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              Vos matchs
            </p>
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                {totalUnread}
              </span>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {sorted.map((item) => {
              const p         = item.mission.profile;
              const initials  = getInitials(p.name);
              const initColor = getInitialsColor(p.name);
              const isUnread  = item.matchId ? unreadIds.has(item.matchId) : false;
              const shortName = p.name
                ? p.name.split(" ")[0].slice(0, 10)
                : { TITULAIRE: "Cabinet", REMPLACANT: "Kine", ASSISTANT: "Assist." }[p.type] ?? "Profil";

              return (
                <button
                  key={item.mission.id}
                  onClick={() => {
                    setSelected(item);
                    if (item.matchId) {
                      setUnreadIds(prev => {
                        const next = new Set(prev);
                        next.delete(item.matchId as string);
                        return next;
                      });
                      setSeenIds(prev => new Set(Array.from(prev).concat([item.matchId as string])));
                    }
                  }}
                  className="relative shrink-0 flex flex-col items-center gap-0.5 group"
                >
                  <div className={`relative w-11 h-11 rounded-2xl overflow-hidden border-2 transition group-hover:scale-105 ${
                    item.matchId
                      ? "border-emerald-400 shadow-emerald-100 shadow-md"
                      : "border-kine-200"
                  }`}>
                    {p.photoUrl ? (
                      <Image
                        src={p.photoUrl}
                        alt={item.mission.title}
                        fill
                        className="object-cover"
                        sizes="44px"
                        unoptimized
                      />
                    ) : (
                      <div className={`w-full h-full ${initColor} flex items-center justify-center`}>
                        <span className="text-sm font-black text-white">{initials}</span>
                      </div>
                    )}

                    {/* Badge rouge non-lu */}
                    {isUnread && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                    )}

                    {/* Pastille match vu */}
                    {item.matchId && !isUnread && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border border-white flex items-center justify-center">
                        <span className="text-white text-[7px] font-bold">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Nom abrégé */}
                  <span className="text-[9px] text-gray-500 font-medium leading-none truncate max-w-[48px]">
                    {shortName}
                  </span>

                  {/* Score affinité */}
                  {item.affinityScore !== null && (
                    <span className="text-[8px] font-bold text-kine-600 bg-kine-50 rounded-full px-1.5 leading-3 py-0.5">
                      {Math.round(item.affinityScore)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <MissionSheet
          item={selected}
          onClose={() => setSelected(null)}
          onCancelled={(matchId) => {
            // Retrait local immédiat, sans reload
            setItems(prev => prev.filter(i => i.matchId !== matchId));
            setUnreadIds(prev => {
              const next = new Set(prev);
              next.delete(matchId);
              return next;
            });
            prevMatchIdsRef.current.delete(matchId);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
