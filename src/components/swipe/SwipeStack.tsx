"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  AnimatePresence,
} from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, Heart } from "lucide-react";
import { Mission, MissionType, Profile } from "@prisma/client";
import { trackRecentMission, RecentMission } from "./RecentMissionsTray";
import { getInitials, getInitialsColor } from "@/components/ui/PhotoUpload";
import MissionSelector, { TitulaireMission } from "./MissionSelector";
import MissionDetailSheet from "./MissionDetailSheet";

type MissionWithProfile = Mission & { profile: Profile };
type MissionFilter = "ALL" | "REMPLACEMENT" | "ASSISTANAT" | "COLLABORATION";

interface ActiveMissionData {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
}

interface MatchData {
  matchId: string;
  affinityScore: number | null;
  theirName: string | null;
  theirInitials: string;
  theirType: keyof typeof TYPE_CONFIG;
}

interface SwipeStackProps {
  onSwipeRight?: () => void;
  profileType?: string;
  titulaireMissions?: TitulaireMission[];
  initialMissionId?: string;
}

const TYPE_CONFIG = {
  REMPLACANT: { label: "Remplaçant",  color: "bg-blue-500",    emoji: "🩺"  },
  ASSISTANT:  { label: "Assistant",   color: "bg-violet-500",  emoji: "👩‍⚕️" },
  TITULAIRE:  { label: "Cabinet",     color: "bg-emerald-600", emoji: "🏥"  },
} as const;

const FILTER_LABELS: Record<MissionFilter, string> = {
  ALL:           "Tout",
  REMPLACEMENT:  "Remplacement",
  ASSISTANAT:    "Assistanat",
  COLLABORATION: "Collaboration",
};

function fmt(d: Date | string | null): string | null {
  if (!d) return null;
  return new Date(d as string).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

function computeCompatibility(
  candidatStart: Date | null, candidatEnd: Date | null,
  missionStart: Date | null, missionEnd: Date | null
): { pct: number; label: string; barColor: string; textColor: string } {
  if (!candidatStart || !candidatEnd || !missionStart || !missionEnd) {
    return { pct: 0, label: "Dates non renseignées", barColor: "bg-gray-300", textColor: "text-gray-400" };
  }
  const overlap = Math.max(0,
    Math.min(candidatEnd.getTime(), missionEnd.getTime()) -
    Math.max(candidatStart.getTime(), missionStart.getTime())
  );
  if (overlap <= 0) {
    return { pct: 0, label: "Non compatible", barColor: "bg-red-400", textColor: "text-red-500" };
  }
  const missionDur = missionEnd.getTime() - missionStart.getTime();
  const pct = Math.min(Math.round((overlap / missionDur) * 100), 100);
  if (pct >= 90) {
    return { pct, label: "Compatible", barColor: "bg-emerald-400", textColor: "text-emerald-600" };
  }
  return { pct, label: "Partiellement compatible", barColor: "bg-amber-400", textColor: "text-amber-600" };
}

function hasDateOverlap(
  cStart: Date | null, cEnd: Date | null,
  mStart: Date | null, mEnd: Date | null
): boolean {
  if (!cStart || !cEnd || !mStart || !mEnd) return false;
  return cStart.getTime() <= mEnd.getTime() && cEnd.getTime() >= mStart.getTime();
}

// ── Match modal ────────────────────────────────────────────────────────────────
function MatchModal({ match, onClose }: { match: MatchData; onClose: () => void }) {
  const router = useRouter();
  const pct = match.affinityScore !== null ? Math.min(Math.round(match.affinityScore), 100) : null;

  return (
    <motion.div
      key="match-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600 px-6"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              backgroundColor: ["#fff","#d1fae5","#a7f3d0","#6ee7b7","#fbbf24","#f9a8d4"][i % 6],
              left: `${(i * 17 + 5) % 100}%`,
              top: `${(i * 23 + 10) % 80}%`,
            }}
            animate={{ y: [0, -30, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>

      <motion.h1
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-5xl font-black text-white text-center mb-1 drop-shadow-lg"
      >
        Nouvelle mise en relation !
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-emerald-100 text-sm mb-8 text-center"
      >
        Vous vous êtes mutuellement sélectionnés
      </motion.p>

      <motion.div
        className="flex items-center gap-0 mb-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
      >
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 180 }}
          className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-2xl z-10"
        >
          <span className="text-3xl font-black text-white">Vous</span>
        </motion.div>
        <div className="w-8 flex items-center justify-center z-20">
          <span className="text-2xl">💚</span>
        </div>
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 180 }}
          className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-2xl z-10"
        >
          <span className="text-3xl font-black text-white">{match.theirInitials}</span>
        </motion.div>
      </motion.div>

      {pct !== null && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xs mb-3"
        >
          <div className="flex justify-between text-xs text-emerald-100 mb-1.5">
            <span>Score d&apos;affinité</span>
            <span className="font-bold text-white">{pct}%</span>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: 0.65, duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-emerald-100 text-xs text-center mb-10 max-w-xs"
      >
        Le match n&apos;engage à rien — c&apos;est le début d&apos;une conversation.
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <button
          onClick={() => router.push(`/match/${match.matchId}`)}
          className="md3-ripple w-full py-4 bg-white text-emerald-700 rounded-2xl font-bold text-base shadow-lg active:scale-[0.98] transition"
        >
          Envoyer un message →
        </button>
        <button
          onClick={onClose}
          className="md3-ripple w-full py-3.5 border-2 border-white/40 text-white rounded-2xl font-semibold text-sm hover:border-white/70 active:scale-[0.98] transition"
        >
          Voir plus tard
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Carte deux colonnes (style Meetic) ─────────────────────────────────────────
function Card({
  mission,
  activeMission,
  otherMissions,
  onSwitchMission,
  onOpenDetail,
}: {
  mission: MissionWithProfile;
  activeMission?: ActiveMissionData | null;
  otherMissions?: ActiveMissionData[];
  onSwitchMission?: (id: string) => void;
  onOpenDetail?: (mission: MissionWithProfile) => void;
}) {
  const p = mission.profile;
  const tc = TYPE_CONFIG[p.type as keyof typeof TYPE_CONFIG]
    ?? { label: p.type, color: "bg-gray-500", emoji: "👤" };

  const dateRange =
    mission.startDate && mission.endDate
      ? `${fmt(mission.startDate)} → ${fmt(mission.endDate)}`
      : mission.startDate
      ? `Dès le ${fmt(mission.startDate)}`
      : null;

  const bioText =
    (mission as MissionWithProfile & { bioTinder?: string | null }).bioTinder ??
    (p as Profile & { bioTinder?: string | null }).bioTinder ??
    null;

  const initials  = getInitials(p.name);
  const initColor = getInitialsColor(p.name);

  // Compatibilité dates avec la mission active TITULAIRE
  const compat = activeMission
    ? computeCompatibility(
        toDate(mission.startDate), toDate(mission.endDate),
        toDate(activeMission.startDate), toDate(activeMission.endDate)
      )
    : null;

  // "Compatible aussi avec" — première autre mission compatible
  const compatOther = otherMissions?.find(m =>
    hasDateOverlap(
      toDate(mission.startDate), toDate(mission.endDate),
      toDate(m.startDate), toDate(m.endDate)
    )
  ) ?? null;

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white flex">
      {/* Déclencheur discret "i" — ouvre la fiche détaillée (bottom sheet, section 4).
          stopPropagation sur pointerdown pour ne pas déclencher le drag de swipe. */}
      {onOpenDetail && (
        <button
          type="button"
          aria-label="Voir la fiche détaillée"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpenDetail(mission); }}
          className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-white/85 backdrop-blur text-gray-600 shadow flex items-center justify-center hover:bg-white transition"
        >
          <span className="text-sm font-bold italic leading-none">i</span>
        </button>
      )}
      {/* ── Colonne gauche : Photo 40% ── */}
      <div className="relative shrink-0 bg-gradient-to-br from-kine-200 via-kine-500 to-kine-900" style={{ width: "40%" }}>
        {p.photoUrl ? (
          <Image
            src={p.photoUrl}
            alt="Photo"
            fill
            className="object-cover"
            sizes="(max-width: 480px) 40vw, 192px"
            unoptimized
          />
        ) : (
          <div className={`absolute inset-0 ${initColor} flex items-center justify-center`}>
            <span className="text-4xl font-black text-white select-none">{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Type badge + badge Partenaire CPTS (item 24) */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white shadow ${tc.color}`}>
            {tc.label}
          </span>
          {(p as Profile & { institutionalPartner?: boolean }).institutionalPartner && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow bg-[#1B3A5C] flex items-center gap-1">
              🏛️ Partenaire CPTS
            </span>
          )}
        </div>

        {/* Rating */}
        {p.ratingCount > 0 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <span className="px-2.5 py-0.5 bg-black/50 backdrop-blur-sm text-yellow-300 text-xs font-bold rounded-full">
              ★ {p.ratingAvg?.toFixed(1)} <span className="text-white/60 font-normal">({p.ratingCount})</span>
            </span>
          </div>
        )}

        {/* Sponsored */}
        {p.isPaid && (
          <div className="absolute top-3 right-1">
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-400 text-yellow-900 shadow">
              ⭐
            </span>
          </div>
        )}
      </div>

      {/* ── Colonne droite : Info 60% ── */}
      <div className="flex-1 flex flex-col px-3.5 pt-4 pb-3 gap-2 overflow-hidden min-w-0">
        {/* Nom + titre */}
        <div>
          {p.name && (
            <p className="text-sm font-black text-gray-900 leading-tight truncate">{p.name}</p>
          )}
          <h3 className="text-[13px] font-semibold text-gray-600 leading-snug line-clamp-2 mt-0.5">
            {mission.title}
          </h3>
        </div>

        {/* Lieu */}
        <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
          <span>📍</span>
          <span className="truncate">{mission.location}</span>
        </p>

        {/* BioTinder */}
        {bioText && (
          <p className="text-kine-700 text-xs italic border-l-2 border-kine-400 pl-2.5 line-clamp-2 bg-kine-50 rounded-r-xl py-1.5 pr-2 shrink-0">
            {bioText}
          </p>
        )}

        {/* Dates */}
        {dateRange && (
          <div className="flex items-center gap-1.5 bg-kine-50 rounded-xl px-2.5 py-1.5 shrink-0">
            <span className="text-sm">📅</span>
            <span className="text-kine-700 text-xs font-semibold">{dateRange}</span>
          </div>
        )}

        {/* Durée min */}
        {mission.minMonths ? (
          <div className="flex items-center gap-1.5 bg-violet-50 rounded-xl px-2.5 py-1.5 shrink-0">
            <span className="text-sm">⏱</span>
            <span className="text-violet-700 text-xs font-semibold">{mission.minMonths} mois min.</span>
          </div>
        ) : null}

        {/* Barre de compatibilité dates (TITULAIRE uniquement) */}
        {compat && (
          <div className="bg-gray-50 rounded-xl px-2.5 py-2 shrink-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-400">📅 Compatibilité</span>
              <span className={`text-[10px] font-bold ${compat.textColor}`}>{compat.label}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${compat.barColor} rounded-full`}
                style={{ width: `${compat.pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Badge "Compatible aussi avec" */}
        {compatOther && onSwitchMission && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwitchMission(compatOther.id); }}
            className="text-[10px] text-kine-600 underline decoration-dotted hover:text-kine-800 text-left leading-snug shrink-0"
          >
            ℹ️ Compatible aussi avec &ldquo;{compatOther.title}&rdquo;
          </button>
        )}

        {/* Spécialités */}
        {mission.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {mission.specialties.slice(0, 3).map(s => (
              <span key={s} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-600">
                {s}
              </span>
            ))}
            {mission.specialties.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-400">
                +{mission.specialties.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SwipeStack principal ───────────────────────────────────────────────────────
export default function SwipeStack({ onSwipeRight, profileType, titulaireMissions, initialMissionId }: SwipeStackProps) {
  const isTitulaire = profileType === "TITULAIRE";

  const [detailMission,    setDetailMission]    = useState<MissionWithProfile | null>(null);
  const [missions,         setMissions]         = useState<MissionWithProfile[]>([]);
  const [loading,          setLoading]           = useState(true);
  const [feedError,        setFeedError]         = useState(false);
  const [swiping,          setSwiping]           = useState(false);
  const [match,            setMatch]             = useState<MatchData | null>(null);
  const [filter,           setFilter]            = useState<MissionFilter>("ALL");
  const [activeMissionId,  setActiveMissionId]   = useState<string | null>(
    initialMissionId ?? titulaireMissions?.[0]?.id ?? null
  );
  // Skip the mission-switch effect on initial mount — initial fetch is handled by the [fetchFeed] effect
  const missionSwitchMounted = useRef(false);

  const x        = useMotionValue(0);
  const rotate   = useTransform(x, [-200, 200], [-15, 15]);
  const likeOp   = useTransform(x, [40, 120],   [0, 1]);
  const passOp   = useTransform(x, [-120, -40], [1, 0]);
  const controls = useAnimation();

  // Missions visibles selon le filtre actif
  const displayMissions = useMemo(
    () => filter === "ALL"
      ? missions
      : missions.filter(m => m.missionType === (filter as unknown as MissionType)),
    [missions, filter]
  );

  // ActiveMission data for Card compat bar
  const activeMissionData: ActiveMissionData | null = useMemo(() => {
    if (!isTitulaire || !activeMissionId || !titulaireMissions) return null;
    const m = titulaireMissions.find(m => m.id === activeMissionId);
    return m ? { id: m.id, title: m.title, startDate: m.startDate, endDate: m.endDate } : null;
  }, [isTitulaire, activeMissionId, titulaireMissions]);

  // Other missions for "compatible aussi avec" badge
  const otherMissionsData: ActiveMissionData[] = useMemo(() => {
    if (!isTitulaire || !activeMissionId || !titulaireMissions) return [];
    return titulaireMissions
      .filter(m => m.id !== activeMissionId)
      .map(m => ({ id: m.id, title: m.title, startDate: m.startDate, endDate: m.endDate }));
  }, [isTitulaire, activeMissionId, titulaireMissions]);

  // ── Fetch feed ──────────────────────────────────────────────────────────────
  const fetchFeed = useCallback(async (currentMissionId?: string | null) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const missionParam = (isTitulaire && currentMissionId)
        ? `&targetMissionId=${encodeURIComponent(currentMissionId)}`
        : "";
      const r = await fetch(`/api/feed?limit=20${missionParam}`, { signal: controller.signal });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        console.error("[SwipeStack] feed non-OK", r.status, text);
        setFeedError(true);
        return;
      }
      const data = await r.json();
      if (!Array.isArray(data)) {
        console.error("[SwipeStack] feed response is not an array:", data);
        setFeedError(true);
        return;
      }
      setFeedError(false);
      setMissions(prev => {
        const seen = new Set(prev.map(m => m.id));
        return [...prev, ...(data as MissionWithProfile[]).filter(m => !seen.has(m.id))];
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        console.error("[SwipeStack] feed timeout après 12s");
      } else {
        console.error("[SwipeStack]", e);
      }
      setFeedError(true);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [isTitulaire]);

  // Initial load
  useEffect(() => { fetchFeed(activeMissionId); }, [fetchFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset + re-fetch when active mission changes (skips initial mount)
  useEffect(() => {
    if (!missionSwitchMounted.current) {
      missionSwitchMounted.current = true;
      return;
    }
    if (!isTitulaire) return;
    setMissions([]);
    setLoading(true);
    fetchFeed(activeMissionId);
  }, [activeMissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracker la mission du dessus
  useEffect(() => {
    if (displayMissions.length > 0) {
      const m = displayMissions[0];
      const recent: RecentMission = {
        id: m.id, title: m.title, location: m.location,
        description: m.description, startDate: m.startDate, endDate: m.endDate,
        specialties: m.specialties,
        profile: { type: m.profile.type, name: m.profile.name ?? null },
      };
      trackRecentMission(recent);
    }
  }, [displayMissions[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Préchargement quand le stock descend
  useEffect(() => {
    if (!loading && missions.length > 0 && missions.length < 4) fetchFeed(activeMissionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions.length]);

  // ── Swipe ───────────────────────────────────────────────────────────────────
  const doSwipe = useCallback(async (direction: "LEFT" | "RIGHT") => {
    if (swiping || displayMissions.length === 0) return;
    const top = displayMissions[0];
    setSwiping(true);

    await controls.start({
      x:       direction === "RIGHT" ? 620 : -620,
      rotate:  direction === "RIGHT" ? 22  : -22,
      opacity: 0,
      transition: { duration: 0.28, ease: "easeOut" },
    });

    setMissions(prev => prev.filter(m => m.id !== top.id));
    x.set(0);
    controls.set({ x: 0, rotate: 0, opacity: 1 });
    setSwiping(false);

    const payload: Record<string, unknown> = { swipedMissionId: top.id, direction };
    if (isTitulaire && activeMissionId) {
      payload.targetMissionId = activeMissionId;
    }

    if (direction === "RIGHT") {
      onSwipeRight?.();
      try {
        const res = await fetch("/api/swipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.match) {
            const m = data.match;
            const theirProfile: Profile | null =
              m.profileA?.id !== top.profileId ? m.profileA : m.profileB;
            setMatch({
              matchId: m.id,
              affinityScore: data.affinityScore ?? null,
              theirName: theirProfile?.name ?? null,
              theirInitials: getInitials(theirProfile?.name),
              theirType: (theirProfile?.type as keyof typeof TYPE_CONFIG) ?? "TITULAIRE",
            });
          }
        }
      } catch (e) {
        console.error("[SwipeStack swipe]", e);
      }
    } else {
      fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(console.error);
    }
  }, [swiping, displayMissions, controls, x, onSwipeRight, isTitulaire, activeMissionId]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    const ox = info.offset.x;
    if (ox > 100)       doSwipe("RIGHT");
    else if (ox < -100) doSwipe("LEFT");
  }

  // ── Cas TITULAIRE sans missions actives ─────────────────────────────────────
  if (isTitulaire && titulaireMissions && titulaireMissions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <span className="text-6xl">📋</span>
        <p className="text-gray-500 font-semibold">Aucune mission active</p>
        <p className="text-gray-400 text-sm">Créez une annonce pour commencer à recevoir des candidatures</p>
        <a
          href="/missions/create"
          className="px-6 py-3 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition"
        >
          + Créer une annonce
        </a>
      </div>
    );
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-kine-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Chargement des annonces…</p>
        </div>
      </div>
    );
  }

  if (feedError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <span className="text-5xl">⚠️</span>
        <p className="text-gray-500 font-semibold">Impossible de charger les annonces</p>
        <p className="text-gray-400 text-sm">Vérifiez votre connexion ou réessayez</p>
        <button
          onClick={() => { setFeedError(false); setLoading(true); fetchFeed(activeMissionId); }}
          className="px-6 py-3 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (displayMissions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <span className="text-6xl">🌊</span>
        <p className="text-gray-500 font-semibold">
          {filter === "ALL"
            ? "Plus d'annonces pour le moment"
            : `Aucune annonce "${FILTER_LABELS[filter]}" pour le moment`}
        </p>
        <p className="text-gray-400 text-sm">Revenez plus tard ou publiez vos disponibilités</p>
        {filter !== "ALL" && (
          <button
            onClick={() => setFilter("ALL")}
            className="px-5 py-2.5 border border-kine-200 text-kine-700 rounded-xl text-sm font-semibold hover:bg-kine-50 transition"
          >
            Voir toutes les annonces
          </button>
        )}
        <a
          href="/missions/create"
          className="px-6 py-3 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition"
        >
          + Publier une annonce
        </a>
      </div>
    );
  }

  const stack = displayMissions.slice(0, 3);

  return (
    <>
      <AnimatePresence>
        {match && <MatchModal match={match} onClose={() => setMatch(null)} />}
      </AnimatePresence>

      {/* Fiche détaillée (bottom sheet, section 4) */}
      {detailMission && (
        <MissionDetailSheet mission={detailMission} onClose={() => setDetailMission(null)} />
      )}

      <div className="flex-1 flex flex-col min-h-0 select-none">
        {/* ── Sélecteur de mission (TITULAIRE uniquement) ── */}
        {isTitulaire && titulaireMissions && titulaireMissions.length > 0 && (
          <MissionSelector
            missions={titulaireMissions}
            selectedId={activeMissionId}
            onSelect={(id) => setActiveMissionId(id)}
          />
        )}

        {/* ── Filter pills ── */}
        <div className="flex items-center gap-2 px-4 pt-2 pb-1 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
          {(["ALL", "REMPLACEMENT", "ASSISTANAT", "COLLABORATION"] as MissionFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === f
                  ? "bg-kine-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* ── Pile de cartes ── (desktop >=1024px : largeur limitée à 66%, centrée — section 63) */}
        <div className="relative flex-1 mx-4 mt-2 mb-2 min-h-0 w-full lg:max-w-[66%] lg:mx-auto">
          {/* Cartes du fond */}
          {stack.slice(1).reverse().map((mission, ri) => {
            const idx    = stack.length - 1 - ri;
            const scale  = 1 - idx * 0.045;
            const yOff   = idx * 11;
            const rotOff = idx === 1 ? 1.5 : -1.5;
            return (
              <div
                key={mission.id}
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 10 - idx * 3,
                  transform: `scale(${scale}) translateY(${yOff}px) rotate(${rotOff}deg)`,
                  transformOrigin: "bottom center",
                  transition: "transform 0.25s ease",
                  opacity: 0.88,
                }}
              >
                <Card mission={mission} />
              </div>
            );
          })}

          {/* Carte du dessus — draggable */}
          <motion.div
            key={stack[0].id}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ x, rotate, zIndex: 30 }}
            animate={controls}
            drag={swiping ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            whileTap={{ scale: 1.01 }}
          >
            <Card
              mission={stack[0]}
              activeMission={activeMissionData}
              otherMissions={otherMissionsData}
              onSwitchMission={isTitulaire ? (id) => setActiveMissionId(id) : undefined}
              onOpenDetail={setDetailMission}
            />

            {/* Overlay OUI */}
            <motion.div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ opacity: likeOp }}>
              <div className="absolute inset-0 bg-emerald-400/15 rounded-3xl" />
              <div className="absolute top-8 left-6 border-4 border-emerald-400 rounded-2xl px-5 py-2 -rotate-12">
                <span className="text-emerald-400 font-black text-3xl tracking-widest">OUI !</span>
              </div>
            </motion.div>

            {/* Overlay PASS */}
            <motion.div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ opacity: passOp }}>
              <div className="absolute inset-0 bg-red-400/15 rounded-3xl" />
              <div className="absolute top-8 right-6 border-4 border-red-400 rounded-2xl px-5 py-2 rotate-12">
                <span className="text-red-400 font-black text-3xl tracking-widest">PASS</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Boutons Pass / Intérêt — FAB Material 3 (section 8) ── */}
        {displayMissions.length > 0 && (
          <div className="flex items-center justify-center gap-10 sm:gap-14 py-3 shrink-0">
            {/* PASS — outlined FAB : fond clair, contour subtil, icône grise → rouge doux */}
            <button
              onClick={() => doSwipe("LEFT")}
              disabled={swiping}
              aria-label="Passer"
              className="shrink-0 w-16 h-16 rounded-full bg-white border border-gray-200 text-gray-500 shadow-md hover:bg-red-50 hover:text-red-500 hover:border-red-200 active:scale-90 transition disabled:opacity-40 flex items-center justify-center"
            >
              <X size={30} strokeWidth={2} />
            </button>
            {/* INTÉRESSÉ — filled FAB : fond plein marque (#0B3D5C), icône blanche */}
            <button
              onClick={() => doSwipe("RIGHT")}
              disabled={swiping}
              aria-label="Intéressé"
              className="shrink-0 w-16 h-16 rounded-full bg-[#0B3D5C] text-white shadow-lg hover:bg-[#0e4d73] active:scale-90 transition disabled:opacity-40 flex items-center justify-center"
            >
              <Heart size={28} strokeWidth={2} fill="currentColor" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
