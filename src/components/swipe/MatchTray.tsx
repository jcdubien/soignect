"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Mission, Profile } from "@prisma/client";
import { getInitials, getInitialsColor } from "@/components/ui/PhotoUpload";
import { fmtDay } from "@/lib/dates";
import type { TitulaireMission } from "@/components/swipe/MissionSelector";
import BottomSheet from "@/components/ui/md3/BottomSheet";
import Button from "@/components/ui/md3/Button";

const ChatModal = dynamic(() => import("@/components/chat/ChatModal"), { ssr: false });

type MissionWithProfile = Mission & { profile: Profile };

// Barèmes du détail de score selon le profil de pondération utilisé (section 120).
const SCORE_WEIGHTS: Record<string, { dates: number; geo: number; bio: number; logement: number; desirability: number }> = {
  REMPLACEMENT:  { dates: 35, geo: 25, bio: 20, logement: 10, desirability: 10 },
  COLLABORATION: { dates: 35, geo: 25, bio: 30, logement: 0,  desirability: 10 },
  ASSISTANAT:    { dates: 15, geo: 20, bio: 50, logement: 0,  desirability: 15 },
};
const SCORE_PROFILE_LABEL: Record<string, string> = { REMPLACEMENT: "Remplacement", COLLABORATION: "Collaboration", ASSISTANAT: "Assistanat" };

interface TrayItem {
  mission: MissionWithProfile;
  affinityScore:    number | null;
  scoreDetails:     Record<string, number | string> | null;
  matchId:          string | null;
  aiScore:          number | null;
  matchCreatedAt:   string | null;
  matchStatus:      string | null;
  contratConfirmed: boolean;
}

interface MatchTrayProps {
  /** Incrémenté par le parent après chaque swipe RIGHT pour forcer un refetch */
  refreshKey?: number;
  /** Missions ouvertes du titulaire — pour réaffecter une relation (item 10) */
  titulaireMissions?: TitulaireMission[];
  /** Type et id du profil courant — gating du bouton contrat + chat inline (section 61) */
  myProfileType?: string;
  myProfileId?: string;
  /** Abonné Premium/Boost — débloque l'envoi de contrat (item 8) */
  isPremium?: boolean;
  /** Filtre le tray sur une disponibilité précise du remplaçant (section 7) */
  disponibiliteId?: string;
}

// ── Fiche complète de l'annonce ───────────────────────────────────────────────
function MissionSheet({
  item, onClose, onCancelled, onRemoved, titulaireMissions = [], onReassigned, myProfileType, myProfileId, isPremium,
}: {
  item: TrayItem;
  onClose: () => void;
  onCancelled: (matchId: string) => void;
  onRemoved: (missionId: string) => void;
  titulaireMissions?: TitulaireMission[];
  onReassigned?: () => void;
  myProfileType?: string;
  myProfileId?: string;
  isPremium?: boolean;
}) {
  const { mission } = item;
  const p = mission.profile;
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [removing, setRemoving]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [chatOpen, setChatOpen]     = useState(false);

  // Section 98 — "Vos choix" (swipe RIGHT non réciproque) : pouvoir se désengager.
  // Supprime le Swipe → la mission redevient visible dans le feed swipe.
  async function handleRemoveChoice() {
    if (removing) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/swipe?missionId=${encodeURIComponent(mission.id)}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Le retrait a échoué. Réessayez.");
        setRemoving(false);
        return;
      }
      onRemoved(mission.id);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setRemoving(false);
    }
  }

  // "Envoyer un contrat" visible uniquement côté recruteur (titulaire/assistant)
  const canSendContract = myProfileType === "TITULAIRE" || myProfileType === "ASSISTANT";

  // Item 10 — réaffecter cette relation à une autre mission ouverte (si plusieurs)
  const canReassign = !!item.matchId && titulaireMissions.length > 1;
  async function handleReassign(missionId: string) {
    if (!item.matchId || reassigning) return;
    setReassigning(true);
    try {
      await fetch(`/api/matches/${item.matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMissionId: missionId }),
      });
      onReassigned?.();
    } finally {
      setReassigning(false);
    }
  }

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
    <>
    <BottomSheet open onClose={onClose}>
        <div className="px-6 py-5 flex-1 overflow-y-auto">
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
              {/* Détail des composantes (section 64 — Spécialités retiré) */}
              {item.scoreDetails && (() => {
                // Profil de pondération utilisé (section 120) — détermine les barèmes affichés.
                const profKey = item.scoreDetails?.profile;
                const prof = (profKey === "ASSISTANAT" || profKey === "COLLABORATION") ? profKey : "REMPLACEMENT";
                const max = SCORE_WEIGHTS[prof];
                const rows = [
                  { key: "dates",        label: "Dates",      max: max.dates },
                  { key: "bio",          label: "Affinité",   max: max.bio },
                  { key: "geo",          label: "Proximité",  max: max.geo },
                  // Logement uniquement quand il compte (Remplacement) — section 120/126
                  ...(max.logement > 0 ? [{ key: "logement", label: "Logement", max: max.logement }] : []),
                  { key: "desirability", label: "Visibilité", max: max.desirability },
                ];
                return (
                  <>
                    <div className={`grid gap-1 mt-2 ${rows.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
                      {rows.map(({ key, label, max }) => {
                        const val = Number(item.scoreDetails?.[key] ?? 0);
                        return (
                          <div key={key} className="flex flex-col items-center bg-white rounded-xl p-1.5">
                            <span className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</span>
                            <span className="text-sm font-bold text-kine-600">{val}<span className="text-[9px] text-gray-300">/{max}</span></span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
                      Pondération <span className="font-semibold text-gray-500">{SCORE_PROFILE_LABEL[prof]}</span> ·{" "}
                      <span className="font-semibold text-gray-500">Visibilité</span> = mise en avant selon abonnement et localisation.
                    </p>
                  </>
                );
              })()}
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

          {/* Réaffecter à une mission (item 10) — si plusieurs missions ouvertes */}
          {canReassign && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Poste concerné</label>
              <select
                defaultValue=""
                disabled={reassigning}
                onChange={(e) => { if (e.target.value) handleReassign(e.target.value); }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400 disabled:opacity-50"
              >
                <option value="">Choisir la mission cible…</option>
                {titulaireMissions.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
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
                    {fmtDay(mission.startDate)}
                    {mission.endDate && ` → ${fmtDay(mission.endDate)}`}
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

        </div>

        {/* Footer sticky — 3 CTA (section 61) : Chat / Contrat (recruteur) / Annuler */}
        {item.matchId && (
          <div className="shrink-0 sticky bottom-0 border-t border-gray-100 p-3 flex flex-col gap-2 bg-white">
            <Button
              variant="filled"
              onClick={() => setChatOpen(true)}
              className="w-full !py-2.5 !text-sm"
            >
              Commencer un chat
            </Button>
            {/* Envoyer un contrat — jamais caché (item 8). Grisé + badge Premium
                si non-Premium ; le clic redirige alors vers /premium. */}
            {canSendContract && (
              isPremium ? (
                <Button
                  variant="outlined"
                  onClick={() => router.push(`/match/${item.matchId}/contrat`)}
                  className="w-full !py-2.5 !text-sm"
                >
                  Envoyer un contrat
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/premium")}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-full border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 transition"
                >
                  Envoyer un contrat
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold">Premium</span>
                </button>
              )
            )}
            <Button
              variant="text"
              onClick={() => setConfirming(true)}
              disabled={!canCancel}
              className="w-full !py-2.5 !text-sm !text-red-600 hover:!bg-red-50"
            >
              Annuler le match
            </Button>
          </div>
        )}

        {/* Footer "Vos choix" (swipe non réciproque, section 98) — se désengager */}
        {!item.matchId && (
          <div className="shrink-0 sticky bottom-0 border-t border-gray-100 p-3 flex flex-col gap-1.5 bg-white">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <Button
              variant="text"
              onClick={handleRemoveChoice}
              disabled={removing}
              className="w-full !py-2.5 !text-sm !text-red-600 hover:!bg-red-50"
            >
              {removing ? "Retrait…" : "Retirer ce choix"}
            </Button>
            <p className="text-[11px] text-gray-400 text-center leading-snug px-2">
              L&apos;annonce redeviendra visible dans votre feed.
            </p>
          </div>
        )}
    </BottomSheet>

      {/* Chat inline (section 61) */}
      {chatOpen && item.matchId && (
        <ChatModal
          matchId={item.matchId}
          myProfileId={myProfileId ?? ""}
          partner={{ type: p.type, theirMissionTitle: mission.title }}
          aiScore={item.affinityScore}
          myType={myProfileType}
          onClose={() => setChatOpen(false)}
        />
      )}

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
    </>
  );
}

// ── MatchTray principal ───────────────────────────────────────────────────────
export default function MatchTray({ refreshKey, titulaireMissions = [], myProfileType, myProfileId, isPremium, disponibiliteId }: MatchTrayProps) {
  const [items,       setItems]       = useState<TrayItem[]>([]);
  const [selected,    setSelected]    = useState<TrayItem | null>(null);
  const [, setSeenIds] = useState<Set<string>>(new Set());
  const [unreadIds,   setUnreadIds]   = useState<Set<string>>(new Set());
  const prevMatchIdsRef               = useRef<Set<string>>(new Set());

  const fetchTray = useCallback(async () => {
    try {
      const r = await fetch(`/api/tray${disponibiliteId ? `?disponibiliteId=${encodeURIComponent(disponibiliteId)}` : ""}`);
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
  }, [disponibiliteId]);

  useEffect(() => { fetchTray(); }, [fetchTray, refreshKey]);

  // Item 11 — une mise en relation disparaît du tray après 7 jours (reste dans /matches)
  const SEVEN_DAYS = 7 * 86400000;
  const notExpired = (i: TrayItem) =>
    !i.matchCreatedAt || Date.now() - new Date(i.matchCreatedAt).getTime() < SEVEN_DAYS;
  const byScore = (a: TrayItem, b: TrayItem) => (b.affinityScore ?? 0) - (a.affinityScore ?? 0);
  // Vos mises en relation = réciproques confirmées (matchId). Vos choix = swipes droite en attente.
  const matchedItems = items.filter(i => i.matchId && notExpired(i)).sort(byScore);
  const likedItems   = items.filter(i => !i.matchId).sort(byScore);

  const totalUnread = unreadIds.size;

  // État vide filtré (section 7) : message clair au lieu de masquer le tray
  if (matchedItems.length === 0 && likedItems.length === 0) {
    if (disponibiliteId) {
      return (
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 text-center">
          <p className="text-xs text-gray-500">
            Aucune mise en relation pour cette disponibilité pour l&apos;instant.
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Continuez à explorer les annonces ci-dessus.
          </p>
        </div>
      );
    }
    return null;
  }

  function selectItem(item: TrayItem) {
    setSelected(item);
    if (item.matchId) {
      setUnreadIds(prev => {
        const next = new Set(prev);
        next.delete(item.matchId as string);
        return next;
      });
      setSeenIds(prev => new Set(Array.from(prev).concat([item.matchId as string])));
    }
  }

  // Rendu compact (bande horizontale mobile)
  function renderItem(item: TrayItem) {
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
        onClick={() => selectItem(item)}
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
  }

  // Rendu en ligne (liste verticale, panneau latéral desktop)
  function renderItemRow(item: TrayItem) {
    const p         = item.mission.profile;
    const initials  = getInitials(p.name);
    const initColor = getInitialsColor(p.name);
    const isUnread  = item.matchId ? unreadIds.has(item.matchId) : false;
    const name = p.name ?? ({ TITULAIRE: "Cabinet", REMPLACANT: "Remplaçant", ASSISTANT: "Assistant" } as Record<string, string>)[p.type] ?? "Profil";
    return (
      <button
        key={item.mission.id}
        onClick={() => selectItem(item)}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left"
      >
        <div className={`relative w-10 h-10 shrink-0 rounded-xl overflow-hidden border-2 ${item.matchId ? "border-emerald-400" : "border-kine-200"}`}>
          {p.photoUrl ? (
            <Image src={p.photoUrl} alt="" fill className="object-cover" sizes="40px" unoptimized />
          ) : (
            <div className={`w-full h-full ${initColor} flex items-center justify-center`}>
              <span className="text-xs font-black text-white">{initials}</span>
            </div>
          )}
          {isUnread && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
          <p className="text-[11px] text-gray-400 truncate">{item.matchId ? "Mise en relation" : "En attente de réponse"}</p>
        </div>
        {item.affinityScore !== null && (
          <span className="shrink-0 text-[10px] font-bold text-kine-600 bg-kine-50 rounded-full px-2 py-0.5">
            {Math.round(item.affinityScore)}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* ── Bande horizontale — mobile uniquement (inchangé) ── */}
      <div className="lg:hidden shrink-0 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] max-h-[210px] overflow-y-auto">
        {/* Colonnes côte à côte, à la même hauteur (items-stretch) — chacune défile
            horizontalement de son côté. flex-1 : une seule section présente = pleine largeur. */}
        <div className="px-3 pt-2 pb-3 flex items-stretch gap-2.5">

          {/* ── Vos mises en relation (réciproques confirmées, mises en avant) ── */}
          {matchedItems.length > 0 && (
            <div className="flex-1 min-w-0 rounded-2xl bg-emerald-50/60 border border-emerald-100 px-2.5 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                  Vos mises en relation
                </p>
                {totalUnread > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                    {totalUnread}
                  </span>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {matchedItems.map(renderItem)}
              </div>
            </div>
          )}

          {/* ── Vos choix (swipes à droite en attente de réciprocité) ── */}
          {likedItems.length > 0 && (
            <div className="flex-1 min-w-0 rounded-2xl bg-gray-50 border border-gray-100 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Vos choix
                <span className="ml-1 text-gray-300 normal-case tracking-normal font-normal">· en attente</span>
              </p>
              <div className="flex gap-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {likedItems.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Panneau latéral droit — desktop uniquement (liste verticale) ── */}
      <div className="hidden lg:flex lg:flex-col lg:h-full lg:w-80 lg:shrink-0 lg:border-l lg:border-gray-100 lg:bg-white lg:overflow-y-auto">
        {matchedItems.length > 0 && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">Vos mises en relation</p>
              {totalUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">{matchedItems.map(renderItemRow)}</div>
          </div>
        )}
        {likedItems.length > 0 && (
          <div className={`p-3 ${matchedItems.length > 0 ? "border-t border-gray-100" : ""}`}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Vos choix
              <span className="ml-1 text-gray-300 normal-case tracking-normal font-normal">· en attente</span>
            </p>
            <div className="flex flex-col gap-1">{likedItems.map(renderItemRow)}</div>
          </div>
        )}
      </div>

      {selected && (
        <MissionSheet
          item={selected}
          titulaireMissions={titulaireMissions}
          myProfileType={myProfileType}
          myProfileId={myProfileId}
          isPremium={isPremium}
          onReassigned={() => { fetchTray(); setSelected(null); }}
          onClose={() => setSelected(null)}
          onRemoved={(missionId) => {
            // Section 98 — retrait local immédiat de "Vos choix", sans reload
            setItems(prev => prev.filter(i => i.mission.id !== missionId));
            setSelected(null);
          }}
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
