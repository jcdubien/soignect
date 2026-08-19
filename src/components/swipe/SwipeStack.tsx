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
import { Mission, MissionType, Profile } from "@prisma/client";
import { trackRecentMission, RecentMission } from "./RecentMissionsTray";
import { getInitials, getInitialsColor } from "@/components/ui/PhotoUpload";
import { fmtDay } from "@/lib/dates";
import MissionSelector, { TitulaireMission } from "./MissionSelector";
import { libelleAuteur } from "@/lib/libellesPoste";
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
  /** Profil courant — pour cloisonner l'historique « annonces consultées » par compte. */
  profileId?: string;
  /** Notifie le parent quand aucune carte n'est affichée (vide/chargement/erreur) —
   *  permet de ne pas étirer verticalement la zone et de coller les trays au contenu. */
  onEmptyChange?: (empty: boolean) => void;
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
  return fmtDay(d);
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
}: {
  mission: MissionWithProfile;
  activeMission?: ActiveMissionData | null;
  otherMissions?: ActiveMissionData[];
  onSwitchMission?: (id: string) => void;
}) {
  const p = mission.profile;
  // « Cabinet » était affiché pour tout profil TITULAIRE — un hôpital, un EHPAD ou une clinique
  // s'y retrouvaient étiquetés ainsi sur la carte de swipe. Le libellé vient maintenant de
  // lib/libellesPoste, qui lit titulaireKind (déjà transmis par le feed, jamais expurgé).
  const base = TYPE_CONFIG[p.type as keyof typeof TYPE_CONFIG]
    ?? { label: p.type, color: "bg-gray-500", emoji: "👤" };
  const tc = { ...base, label: libelleAuteur(p) };

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
      {/* Toute la carte est cliquable (tap → fiche détaillée) — voir le motion.div parent.
          Indice visuel discret que la carte ouvre une fiche : */}
      <span className="absolute top-2.5 right-2.5 z-30 w-7 h-7 rounded-full bg-black/35 text-white flex items-center justify-center pointer-events-none">
        <span className="text-xs font-black italic leading-none">i</span>
      </span>
      {/* ── Colonne gauche : Photo 40% ── */}
      <div className="relative shrink-0 bg-gradient-to-br from-kine-200 via-kine-500 to-kine-900" style={{ width: "40%" }}>
        {p.photoUrl ? (
          <Image
            src={p.photoUrl}
            alt="Photo"
            fill
            className="object-cover object-center"
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

// Annonce présélectionnée dans le sélecteur au chargement. La plus ancienne (ordre de
// création) pouvait être PÉRIMÉE : le feed filtre alors les candidats sur des dates
// révolues et ne remonte plus personne, alors que des candidats attendent sur les autres
// annonces. On présélectionne donc la première annonce encore d'actualité — sans date de
// fin, ou dont la fin n'est pas passée — et on ne retombe sur la première que si toutes
// sont expirées.
// ── Ligne de la vue liste (section 202) ───────────────────────────────────────
// Reprend les éléments décisionnels de la carte — auteur, intitulé, commune, dates, accroche,
// compatibilité — dans une densité qui permet la comparaison. Les deux actions sont SUR la
// ligne : sans elles, la liste ne serait qu'un inventaire à consulter, et il faudrait rouvrir
// une fiche pour décider, ce qui la rendrait plus lente que le carrousel.
function LigneListe({
  mission, compat, onChoisir, onOuvrir,
}: {
  mission: MissionWithProfile;
  compat: { pct: number; label: string; barColor: string; textColor: string } | null;
  onChoisir: (direction: "LEFT" | "RIGHT") => void;
  onOuvrir: () => void;
}) {
  const p = mission.profile;
  const base = TYPE_CONFIG[p.type as keyof typeof TYPE_CONFIG]
    ?? { label: p.type, color: "bg-gray-500", emoji: "👤" };
  const tc = { ...base, label: libelleAuteur(p) };
  const dateRange =
    mission.startDate && mission.endDate ? `${fmt(mission.startDate)} → ${fmt(mission.endDate)}`
    : mission.startDate ? `Dès le ${fmt(mission.startDate)}`
    : mission.minMonths ? `${mission.minMonths} mois min.`
    : null;
  const bio =
    (mission as MissionWithProfile & { bioTinder?: string | null }).bioTinder ??
    (p as Profile & { bioTinder?: string | null }).bioTinder ?? null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex gap-4 items-start">
      <button type="button" onClick={onOuvrir} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${tc.color}`}>{tc.label}</span>
          {p.name && <span className="text-sm font-black text-gray-900 truncate">{p.name}</span>}
          {compat && (
            <span className={`text-[11px] font-bold ${compat.textColor}`}>
              {compat.label}{compat.pct > 0 ? ` · ${compat.pct}%` : ""}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800 truncate">{mission.title}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          📍 {mission.location}{dateRange ? ` · ${dateRange}` : ""}
        </p>
        {bio && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 italic">{bio}</p>}
      </button>

      <div className="flex flex-col gap-2 shrink-0 w-32">
        <button
          type="button"
          onClick={() => onChoisir("RIGHT")}
          className="px-3 py-2 rounded-xl bg-kine-600 text-white text-xs font-bold hover:bg-kine-700 transition"
        >
          Intéressé
        </button>
        <button
          type="button"
          onClick={() => onChoisir("LEFT")}
          className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition"
        >
          Passer
        </button>
      </div>
    </div>
  );
}

function defaultMissionId(missions?: TitulaireMission[]): string | null {
  if (!missions || missions.length === 0) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const live = missions.find((m) => !m.endDate || new Date(m.endDate) >= today);
  return (live ?? missions[0]).id;
}

// ── SwipeStack principal ───────────────────────────────────────────────────────
export default function SwipeStack({ onSwipeRight, profileType, titulaireMissions, initialMissionId, profileId, onEmptyChange }: SwipeStackProps) {
  const isTitulaire = profileType === "TITULAIRE";

  const [detailMission,    setDetailMission]    = useState<MissionWithProfile | null>(null);
  const [missions,         setMissions]         = useState<MissionWithProfile[]>([]);
  const [loading,          setLoading]           = useState(true);
  const [feedError,        setFeedError]         = useState(false);
  // Candidats/annonces DISPONIBLES déjà vus (swipés) — renvoyé par le feed (header). Distingue
  // « aucun candidat n'existe » de « vous les avez déjà tous vus » dans l'état vide (section 1).
  const [seenAvailable,    setSeenAvailable]     = useState(0);
  // Nombre d'annonces du feed courant remontées par une priorité territoriale déclarée.
  // 0 = la mention d'ordre ne doit PAS parler de zones prioritaires (voir plus bas).
  const [prioriteTerritoriale, setPrioriteTerritoriale] = useState(0);
  // Établissement uniquement : combien de candidats ont coché « ouvert aux postes salariés ».
  // À zéro, un feed vide n'a rien d'une attente — personne ne peut apparaître. -1 = sans objet.
  const [salariatOptIn,    setSalariatOptIn]     = useState(-1);
  const [swiping,          setSwiping]           = useState(false);
  const [match,            setMatch]             = useState<MatchData | null>(null);
  const [filter,           setFilter]            = useState<MissionFilter>("ALL");
  // Vue alternative (section 202) — desktop TITULAIRE uniquement. Les cartes restent le défaut :
  // la liste est un complément de comparaison, pas un remplacement du geste de décision.
  const [vue,              setVue]               = useState<"cartes" | "liste">("cartes");
  const [activeMissionId,  setActiveMissionId]   = useState<string | null>(
    initialMissionId ?? defaultMissionId(titulaireMissions)
  );
  // Skip the mission-switch effect on initial mount — initial fetch is handled by the [fetchFeed] effect
  const missionSwitchMounted = useRef(false);

  // Détection tap vs drag sur la carte (section correctif) — ouvre le bottom sheet si
  // le déplacement horizontal reste sous le seuil (tap), sinon laisse le swipe s'exécuter.
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const TAP_THRESHOLD = 10;

  // Consultation « vue = consultation » (section 157) : enregistre une consultation dès qu'une
  // annonce est réellement vue (carte au sommet ou fiche ouverte), DÉDUPLIQUÉE — une seule fois
  // par annonce et par session, pour éviter d'inonder le propriétaire d'emails/notifs.
  const consultedRef = useRef<Set<string>>(new Set());
  const registerConsultation = useCallback((missionId: string) => {
    if (consultedRef.current.has(missionId)) return;
    consultedRef.current.add(missionId);
    // Réutilise la route card (garde intégré : ni sa propre annonce, ni déjà swipée)
    // → notif in-app + email au propriétaire. Fire-and-forget.
    fetch(`/api/missions/${missionId}/card`).catch(() => {});
  }, []);

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

  // Classement de la vue liste : compatibilité de DATES avec l'annonce sélectionnée, la plus
  // forte en premier. C'est le seul signal de compatibilité disponible côté client — le score
  // d'affinité complet est calculé côté serveur au moment du swipe, le feed ne le renvoie pas.
  // On classe donc sur ce que la carte affiche déjà, pas sur une valeur inventée ici.
  const listeMissions = useMemo(
    () => displayMissions
      .map((mission) => ({
        mission,
        compat: activeMissionData
          ? computeCompatibility(
              toDate(mission.startDate), toDate(mission.endDate),
              toDate(activeMissionData.startDate), toDate(activeMissionData.endDate),
            )
          : null,
      }))
      .sort((a, b) => (b.compat?.pct ?? -1) - (a.compat?.pct ?? -1)),
    [displayMissions, activeMissionData],
  );

  // Other missions for "compatible aussi avec" badge
  const otherMissionsData: ActiveMissionData[] = useMemo(() => {
    if (!isTitulaire || !activeMissionId || !titulaireMissions) return [];
    return titulaireMissions
      .filter(m => m.id !== activeMissionId)
      .map(m => ({ id: m.id, title: m.title, startDate: m.startDate, endDate: m.endDate }));
  }, [isTitulaire, activeMissionId, titulaireMissions]);

  // Aucune carte affichée (vide / chargement / erreur / titulaire sans mission) → signale
  // le parent pour compacter la mise en page (éviter le grand vide avant les trays).
  const noCards =
    (isTitulaire && !!titulaireMissions && titulaireMissions.length === 0) ||
    loading || feedError || displayMissions.length === 0;
  useEffect(() => { onEmptyChange?.(noCards); }, [noCards, onEmptyChange]);

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
      const seenHdr = r.headers.get("x-feed-seen-available");
      if (seenHdr != null) setSeenAvailable(parseInt(seenHdr, 10) || 0);
      const optInHdr = r.headers.get("x-feed-salariat-optin");
      if (optInHdr != null) setSalariatOptIn(parseInt(optInHdr, 10));
      const prioriteHdr = r.headers.get("x-feed-priorite-territoriale");
      if (prioriteHdr != null) setPrioriteTerritoriale(parseInt(prioriteHdr, 10) || 0);
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
      trackRecentMission(recent, profileId);
      // Vue = consultation (section 157) : la carte au sommet est réellement présentée → on
      // enregistre la consultation (dédupliquée) pour le propriétaire de l'annonce.
      registerConsultation(m.id);
    }
  }, [displayMissions[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Préchargement quand le stock descend
  useEffect(() => {
    if (!loading && missions.length > 0 && missions.length < 4) fetchFeed(activeMissionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions.length]);

  // ── Enregistrement d'un choix ───────────────────────────────────────────────
  // Extrait de doSwipe pour être appelé AUSSI depuis la vue liste (section 202) : l'appariement
  // et la modale de match doivent emprunter le MÊME chemin quelle que soit la vue. Dupliquer
  // l'appel aurait fait diverger les deux présentations d'un même choix — le score se calcule
  // ici, côté serveur, et rien dans la vue ne doit pouvoir l'influencer.
  const enregistrerChoix = useCallback(async (mission: MissionWithProfile, direction: "LEFT" | "RIGHT") => {
    const payload: Record<string, unknown> = { swipedMissionId: mission.id, direction };
    if (isTitulaire && activeMissionId) payload.targetMissionId = activeMissionId;

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
              m.profileA?.id !== mission.profileId ? m.profileA : m.profileB;
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
  }, [isTitulaire, activeMissionId, onSwipeRight]);

  // Choix depuis la LISTE : pas d'animation de carte à jouer, la ligne disparaît simplement.
  const choisirDepuisListe = useCallback(async (mission: MissionWithProfile, direction: "LEFT" | "RIGHT") => {
    setMissions(prev => prev.filter(m => m.id !== mission.id));
    await enregistrerChoix(mission, direction);
  }, [enregistrerChoix]);

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

    await enregistrerChoix(top, direction);
  }, [swiping, displayMissions, controls, x, enregistrerChoix]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    const ox = info.offset.x;
    if (ox > 100)       doSwipe("RIGHT");
    else if (ox < -100) doSwipe("LEFT");
  }

  // ── Raccourcis clavier ← / → (desktop) ──────────────────────────────────────
  // N'existaient pas : ils complètent les contrôles textuels et donnent un chemin
  // 100 % clavier. Neutralisés pendant une saisie, une modale de match, la fiche
  // détaillée ouverte, ou une animation de carte en cours.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (match || detailMission || swiping) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      doSwipe(e.key === "ArrowRight" ? "RIGHT" : "LEFT");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSwipe, match, detailMission, swiping]);

  // ── Cas TITULAIRE sans missions actives ─────────────────────────────────────
  if (isTitulaire && titulaireMissions && titulaireMissions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-10">
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
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-10">
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

  // État vide contextualisé et rassurant (section 163). Côté titulaire, un feed vide = pas
  // (encore) de candidats à swiper — surtout PAS l'absence de son annonce. On le rassure.
  // Il est rendu DANS la mise en page, pas à sa place : en sortant tôt, on emportait aussi le
  // sélecteur d'annonce et les filtres. Le titulaire dont l'annonce présélectionnée ne
  // remontait personne se retrouvait enfermé — plus un seul contrôle pour en changer.
  const emptyState = (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-10">
        {/* Établissement sans aucun candidat opté : ce n'est pas une attente, c'est un vivier
            inexistant — l'icône et le texte doivent le dire, pas rassurer à tort. */}
        <span className="text-6xl">{filter !== "ALL" ? "🔍" : salariatOptIn === 0 ? "💼" : isTitulaire ? (seenAvailable > 0 ? "✅" : "👀") : "🌊"}</span>
        <p className="text-gray-500 font-semibold">
          {filter !== "ALL"
            ? `Aucune annonce "${FILTER_LABELS[filter]}" pour le moment`
            : salariatOptIn === 0
            ? "Aucun candidat ouvert aux postes salariés pour l'instant"
            : isTitulaire
            ? (seenAvailable > 0
                ? "Vous avez déjà vu tous les candidats disponibles"
                : "Aucun candidat disponible pour le moment")
            : "Plus d'annonces pour le moment"}
        </p>
        <p className="text-gray-400 text-sm max-w-xs">
          {salariatOptIn === 0
            ? "Votre annonce est en ligne. Seuls les professionnels ayant coché « ouvert aux postes salariés » dans leur compte peuvent la voir et vous être proposés — aucun ne l'a fait à ce jour. Ils apparaîtront ici dès qu'un premier l'activera."
            : isTitulaire
            ? (seenAvailable > 0
                ? `Vous avez parcouru ${seenAvailable} profil${seenAvailable > 1 ? "s" : ""} actuellement disponible${seenAvailable > 1 ? "s" : ""}. De nouveaux candidats apparaîtront ici dès leur inscription — retrouvez ceux qui vous intéressent dans « Vos mises en relation ».`
                : "Votre annonce est bien en ligne et visible. Dès qu'un candidat correspond, il apparaît ici.")
            : "Revenez plus tard, ou publiez vos disponibilités pour être visible des cabinets."}
        </p>
        {filter !== "ALL" && (
          <button
            onClick={() => setFilter("ALL")}
            className="px-5 py-2.5 border border-kine-200 text-kine-700 rounded-xl text-sm font-semibold hover:bg-kine-50 transition"
          >
            Voir toutes les annonces
          </button>
        )}
        <a
          href={isTitulaire ? "/missions/create" : "/disponibilites/create"}
          className="px-6 py-3 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition"
        >
          {isTitulaire ? "+ Publier une annonce" : "+ Publier une disponibilité"}
        </a>
      </div>
  );

  const stack = displayMissions.slice(0, 3);


  return (
    <>
      <AnimatePresence>
        {match && <MatchModal match={match} onClose={() => setMatch(null)} />}
      </AnimatePresence>

      {/* Fiche détaillée (bottom sheet, section 4).
          Accessibilité (WCAG 2.5.1, « Pointer Gestures ») : sans les boutons du carrousel, le
          glissement — un geste directionnel — serait le SEUL moyen de décider sur mobile. La
          fiche s'ouvre au simple tap sur la carte et porte donc les deux décisions : chemin
          complet pour qui ne peut pas (ou ne veut pas) faire le geste. */}
      {detailMission && (
        <MissionDetailSheet
          mission={detailMission}
          onClose={() => setDetailMission(null)}
          relation={{ swipeDirection: null, matchId: null }}
          onSwipe={async (direction) => { setDetailMission(null); await doSwipe(direction); }}
        />
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

          {/* Bascule cartes / liste (section 202). Placée AU BOUT de la barre de filtres :
              c'est la zone des contrôles « comment je parcours », juste au-dessus de ce
              qu'elle change. `hidden lg:flex` — la liste n'existe pas sous 1024 px, où la
              comparaison côte à côte n'aurait pas la place, et `isTitulaire` la réserve au
              côté employeur (le candidat garde le geste rapide, mobile-first). */}
          {isTitulaire && (
            <div className="hidden lg:flex items-center gap-1 ml-auto shrink-0 bg-gray-100 rounded-full p-0.5">
              {([["cartes", "Cartes"], ["liste", "Liste"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setVue(v)}
                  aria-pressed={vue === v}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    vue === v ? "bg-white text-kine-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transparence sur l'ORDRE d'affichage. La mise en avant commerciale existe — elle ne
            se cache simplement plus à l'intérieur du score de compatibilité, où elle affirmait
            quelque chose de faux sur l'autre partie. Elle est dite, en clair, une fois.

            « et zones prioritaires » avait été retiré le 17/08 : la mention l'affirmait, le
            code ne l'a jamais fait — getDesirabilityPercent() ne contenait AUCUN terme
            géographique. La priorité territoriale existe depuis (section 214), la mention est
            donc revenue, mais CONDITIONNÉE : elle n'apparaît que si au moins une annonce du
            feed courant est réellement remontée à ce titre, sur la même mécanique que le bonus
            saisonnier juste avant. Elle se tait le reste du temps.

            La condition n'est pas un raffinement d'affichage : une phrase écrite en dur
            redeviendrait fausse le jour où plus aucune commune n'est déclarée prioritaire, et
            personne ne le remarquerait — c'est exactement ainsi que la version précédente a
            survécu depuis 979ccd8. Ne jamais réécrire cette mention en inconditionnel.

            « PAR SA CPTS » RETIRÉ LE 18/08, avant tout push. La mention conditionnée était vraie
            sur le MÉCANISME (elle ne s'affiche que si une annonce a réellement remonté) et fausse
            sur la SOURCE : aucune CPTS n'a rien déclaré. Les 112 lignes de `CommuneAPL` portent
            un `updatedAt` identique à la milliseconde (28/06/2026 18:16:37.780) — la colonne est
            `@updatedAt`, donc une seule saisie admin aurait suffi à en décaler une. Aucune ne
            l'est. Les `boost*` non nuls viennent de l'import initial, et suivent l'indicateur
            APL (boost 3 ↔ apl 0 ; boost 2 ↔ apl ≤ 166 ; boost 1 ↔ apl ≤ 203,7).

            C'était la même erreur que 979ccd8 d'un cran plus bas : le mécanisme existait cette
            fois, mais on aurait attribué à une institution un chiffre que personne n'avait posé.
            La formulation actuelle ne nomme donc plus d'auteur. « par sa CPTS » ne revient que
            le jour où une CPTS écrit dans une colonne qui ne contient QUE des déclarations.

            « MANQUANT DE KINÉS » RETIRÉ LE 19/08, audit de généricité. La phrase nommait une
            profession en dur alors que le feed est borné par celle du LECTEUR depuis 924e329 :
            un infirmier aurait lu « manquant de kinés » dans son propre feed. Invisible
            aujourd'hui — les 16 profils en base sont tous kiné — donc exactement le défaut
            latent que 924e329 documentait, réintroduit dans la phrase voisine le lendemain.

            La formulation retenue ne nomme AUCUNE profession, et ce n'est pas un contournement :
            `chargerPrioritesTerritoriales` ne remonte que les déclarations portant sur la
            profession du lecteur, donc « votre profession » est plus exact que n'importe quel
            mot en dur. Aucun vocabulaire à décliner, rien à câbler, et la phrase reste vraie
            pour toute profession future sans être retouchée. */}
        <p className="px-4 pb-1 text-[10px] leading-snug text-gray-400 shrink-0">
          {/* La liste n'est PAS triée comme les cartes : elle classe par compatibilité de dates.
              Garder le même texte aurait affirmé un ordre qui n'est plus celui affiché — la
              règle d'écriture opposable s'applique aussi aux mentions de transparence. */}
          {vue === "liste" ? (
            <>
              Ordre d&apos;affichage : classé par compatibilité de dates avec l&apos;annonce
              sélectionnée, la plus forte en premier. Aucun abonnement n&apos;entre dans ce
              classement — contrairement à la vue Cartes, qui met en avant les comptes abonnés.
            </>
          ) : (
            <>
              Ordre d&apos;affichage : les comptes abonnés et partenaires
              apparaissent en premier{isTitulaire ? ", ainsi que les disponibilités couvrant mai-octobre, période où les remplaçants sont les plus rares" : ""}{prioriteTerritoriale > 0 ? ", ainsi que les postes situés sur une commune où votre profession est signalée comme manquante" : ""}.
              Le score de compatibilité, lui, ne dépend d&apos;aucun abonnement.
            </>
          )}
        </p>

        {/* ── Pile de cartes ── (desktop >=1024px : largeur fixe 480px, centrée — section 63)
            Mobile : pas de `w-full` (il causait un débordement de 32px avec `mx-4`), l'item
            s'étire via le flex en tenant compte des marges.
            Desktop : `lg:w-[480px]` (largeur DÉFINIE) et non `lg:max-w-[480px]` — car `lg:mx-auto`
            désactive le stretch flex, et les cartes étant en `absolute inset-0` (0 largeur en flux),
            un simple max-width laissait le conteneur s'effondrer à 0 → carrousel desktop vide. */}
        {/* Vue LISTE (section 202) — même jeu de missions, classé par compatibilité de dates
            décroissante. Le score ORDONNE, il ne décide pas : chaque ligne porte les deux
            actions et l'utilisateur tranche, exactement comme au carrousel. */}
        {vue === "liste" && isTitulaire ? (
          listeMissions.length === 0 ? emptyState : (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
              {listeMissions.map(({ mission, compat }) => (
                <LigneListe
                  key={mission.id}
                  mission={mission}
                  compat={compat}
                  onChoisir={(d) => { void choisirDepuisListe(mission, d); }}
                  onOuvrir={() => { registerConsultation(mission.id); setDetailMission(mission); }}
                />
              ))}
            </div>
          )
        ) : stack.length === 0 ? emptyState : (
        <div className="relative flex-1 mx-4 mt-2 mb-4 min-h-0 lg:w-[480px] lg:mx-auto">
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

          {/* Carte du dessus — draggable + tap pour ouvrir la fiche détaillée */}
          <motion.div
            key={stack[0].id}
            className="absolute inset-0 cursor-pointer"
            style={{ x, rotate, zIndex: 30 }}
            animate={controls}
            drag={swiping ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            whileTap={{ scale: 1.01 }}
            onPointerDown={(e) => { pointerStart.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={(e) => {
              const s = pointerStart.current;
              pointerStart.current = null;
              if (!s || swiping) return;
              const dx = Math.abs(e.clientX - s.x);
              const dy = Math.abs(e.clientY - s.y);
              // Tap = déplacement sous le seuil ET pas sur un élément interactif interne
              const onInteractive = (e.target as HTMLElement).closest("button, a");
              if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD && !onInteractive) {
                // Ouvrir la fiche = consultation (dédupliquée) ; en pratique déjà enregistrée
                // quand la carte est arrivée au sommet, mais idempotent (section 157).
                registerConsultation(stack[0].id);
                setDetailMission(stack[0]);
              }
            }}
          >
            <Card
              mission={stack[0]}
              activeMission={activeMissionData}
              otherMissions={otherMissionsData}
              onSwitchMission={isTitulaire ? (id) => setActiveMissionId(id) : undefined}
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
        )}

        {/* ── Décision ────────────────────────────────────────────────────────────
             Mobile : aucun bouton — le geste seul (gauche = passer, droite = intéressé).
             Les deux gros FAB ronds ✕/♥ donnaient une couleur « application de rencontre »
             qui ne colle pas à un outil professionnel.
             Desktop : pas de geste naturel à la souris → deux contrôles TEXTUELS sobres,
             doublés des raccourcis clavier ← / →. ── */}
        {displayMissions.length > 0 && (
          <>
            {/* Mobile : rappel discret du geste — sans bouton, l'affordance doit être écrite
                quelque part. Mentionne aussi le tap, qui ouvre la fiche (et ses décisions).
                mt-5 obligatoire : les cartes de la pile sont translatées jusqu'à 22px vers le
                bas et pivotées, elles débordent du conteneur et recouvraient ce texte. */}
            <p className="lg:hidden text-center text-[11px] leading-snug text-gray-400 mt-5 pb-3 px-4 shrink-0">
              Glissez à gauche pour passer, à droite si vous êtes intéressé·e —
              touchez la carte pour ouvrir la fiche.
            </p>

            {/* Même débordement de pile côté desktop : mt-4 en plus du py-3. */}
            <div className="hidden lg:flex flex-col items-center gap-1.5 mt-4 py-3 shrink-0">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => doSwipe("LEFT")}
                  disabled={swiping}
                  className="md3-ripple min-w-[128px] px-5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition disabled:opacity-40"
                >
                  Passer
                </button>
                <button
                  onClick={() => doSwipe("RIGHT")}
                  disabled={swiping}
                  className="md3-ripple min-w-[128px] px-5 py-2 rounded-lg border border-[#0B3D5C]/30 text-sm font-semibold text-[#0B3D5C] hover:bg-[#0B3D5C]/[0.06] transition disabled:opacity-40"
                >
                  Intéressé
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                Raccourcis clavier : <kbd className="font-sans">←</kbd> passer ·{" "}
                <kbd className="font-sans">→</kbd> intéressé
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
