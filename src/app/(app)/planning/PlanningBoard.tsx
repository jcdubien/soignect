"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/md3/Button";
import BottomSheet from "@/components/ui/md3/BottomSheet";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MatchInfo {
  id: string;
  profileA?: { id: string; name: string | null; type: string } | null;
  profileB?: { id: string; name: string | null; type: string } | null;
  missionA?: { title: string; startDate: Date | null; endDate: Date | null } | null;
  missionB?: { title: string; startDate: Date | null; endDate: Date | null } | null;
}

interface MissionData {
  id: string;
  title: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  isActive: boolean;
  missionType: string;
  briqueStatus: string;
  statusUpdatedAt: Date | string | null;
  statusNote: string | null;
  matchesA: MatchInfo[];
  matchesB: MatchInfo[];
}

interface PostData {
  id: string;
  label: string;
  postType: string;
  noticeMonths: number;
  isActive: boolean;
  missions: MissionData[];
}

interface UnlinkedMission {
  id: string;
  title: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  missionType: string;
}

interface SelfMission {
  id: string;
  title: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  briqueStatus: string;
  matchesA: MatchInfo[];
  matchesB: MatchInfo[];
}

interface Props {
  posts: PostData[];
  profileId: string;
  cabinetName: string;
  isEmployeur: boolean;
  unlinkedMissions: UnlinkedMission[];
  selfMissions: SelfMission[];
}

// ── Constantes de la timeline ──────────────────────────────────────────────────

type Zoom = "month" | "quarter" | "year" | "triennial";

const ZOOM_DAYS: Record<Zoom, number> = { month: 30, quarter: 91, year: 365, triennial: 730 };
const ZOOM_LABELS: Record<Zoom, string> = { month: "Mois", quarter: "Trimestre", year: "Année", triennial: "2 ans" };
const TRACK_HEIGHT = 44;
const LABEL_WIDTH  = 140;

const RANGE_START = new Date();
RANGE_START.setMonth(RANGE_START.getMonth() - 6);
RANGE_START.setDate(1);
RANGE_START.setHours(0, 0, 0, 0);

const RANGE_END = new Date(RANGE_START);
RANGE_END.setMonth(RANGE_END.getMonth() + 24);

const TOTAL_DAYS = Math.ceil((RANGE_END.getTime() - RANGE_START.getTime()) / 86400000);

// ── Status styles ──────────────────────────────────────────────────────────────

// Palette section 46 — tokens couleur appliqués aux statuts désignés.
// Texte sombre sur corail (#3D1508) et ambre (#3D2A08) : contraste AA vérifié.
const BRIQUE_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PRESENT:          { bg: "bg-[var(--bleu-marine)]",   text: "text-white",       label: "Présent" },
  ABSENT_CONGE:     { bg: "bg-gray-400",               text: "text-white",       label: "Congé" },
  ABSENT_MALADIE:   { bg: "bg-gray-500",               text: "text-white",       label: "Arrêt maladie" },
  ABSENT_FORMATION: { bg: "bg-gray-300",               text: "text-gray-700",    label: "Formation" },
  OCCUPE:           { bg: "bg-[var(--bleu-marine)]",   text: "text-white",       label: "Occupé" },
  PREAVIS:          { bg: "bg-[var(--ambre)]",         text: "text-[#3D2A08]",   label: "Préavis" },
  RECHERCHE:        { bg: "bg-[var(--ambre)]",         text: "text-[#3D2A08]",   label: "Recrutement" },
  NON_COUVERT:      { bg: "bg-[var(--corail-signal)]", text: "text-[#3D1508]",   label: "Non couvert" },
  FERME:            { bg: "bg-gray-700",               text: "text-white",       label: "Fermé" },
  CONFIRME:         { bg: "bg-[var(--vert-palme)]",    text: "text-white",       label: "Confirmé" },
  EN_ATTENTE:       { bg: "bg-[var(--ambre)]",         text: "text-[#3D2A08]",   label: "En attente" },
  ANNULE:           { bg: "bg-gray-300",               text: "text-gray-600",    label: "Annulé" },
};

// Statuts disponibles selon le contexte de la brique
const TITULAIRE_STATUSES = ["PRESENT", "ABSENT_CONGE", "ABSENT_MALADIE", "ABSENT_FORMATION"];
const REMPLACEMENT_STATUSES = ["CONFIRME", "EN_ATTENTE", "RECHERCHE", "ANNULE"];
const POSTE_STATUSES = ["OCCUPE", "PREAVIS", "RECHERCHE", "NON_COUVERT", "FERME"];

function getAvailableStatuses(mission: MissionData, isSelf: boolean): string[] {
  if (isSelf) return TITULAIRE_STATUSES;
  if (mission.missionType === "REMPLACEMENT") return REMPLACEMENT_STATUSES;
  return POSTE_STATUSES;
}

// ── Segment helpers ────────────────────────────────────────────────────────────

type SelfSegment =
  | { kind: "presence"; start: Date; end: Date }
  | { kind: "absence"; mission: SelfMission; start: Date; end: Date; covered: boolean };

function computeSelfSegments(selfMissions: SelfMission[]): SelfSegment[] {
  const sorted = [...selfMissions]
    .filter(m => toDate(m.startDate) && toDate(m.endDate))
    .sort((a, b) => toDate(a.startDate)!.getTime() - toDate(b.startDate)!.getTime());

  const segments: SelfSegment[] = [];
  let cursor = RANGE_START;

  for (const m of sorted) {
    const mStart = toDate(m.startDate)!;
    const mEnd   = toDate(m.endDate)!;
    if (mEnd <= RANGE_START || mStart >= RANGE_END) continue;
    const segStart = mStart < RANGE_START ? RANGE_START : mStart;
    const segEnd   = mEnd   > RANGE_END   ? RANGE_END   : mEnd;
    if (cursor < segStart) segments.push({ kind: "presence", start: cursor, end: segStart });
    const covered = m.matchesA.length > 0 || m.matchesB.length > 0;
    segments.push({ kind: "absence", mission: m, start: segStart, end: segEnd, covered });
    if (segEnd > cursor) cursor = segEnd;
  }
  if (cursor < RANGE_END) segments.push({ kind: "presence", start: cursor, end: RANGE_END });
  return segments;
}

function computeUncoveredGaps(missions: MissionData[]): { start: Date; end: Date }[] {
  const now = new Date();
  if (now >= RANGE_END) return [];
  const effectiveStart = now > RANGE_START ? now : RANGE_START;
  const covered = missions
    .filter(m => toDate(m.startDate) && toDate(m.endDate))
    .map(m => ({ start: toDate(m.startDate)!, end: toDate(m.endDate)! }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: { start: Date; end: Date }[] = [];
  let cursor = effectiveStart;
  for (const seg of covered) {
    if (seg.start > cursor) gaps.push({ start: cursor, end: seg.start < RANGE_END ? seg.start : RANGE_END });
    if (seg.end > cursor) cursor = seg.end;
  }
  if (cursor < RANGE_END) gaps.push({ start: cursor, end: RANGE_END });
  return gaps;
}

// Graduation d'urgence d'une zone non couverte selon la proximité (section 47)
function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function uncoveredUrgency(gapStart: Date): { cls: string; urgent: boolean; label: string } {
  const joursAvant = daysUntil(gapStart);
  if (joursAvant <= 30) return { cls: "bg-[var(--corail-signal)]", urgent: true,  label: "Critique — agir maintenant" };
  if (joursAvant <= 90) return { cls: "bg-[var(--orange-vif)]",    urgent: false, label: "À traiter dans les prochaines semaines" };
  return { cls: "bg-[var(--orange-pale)]", urgent: false, label: "À anticiper" };
}

// ── Panel types ────────────────────────────────────────────────────────────────

type Panel =
  | { type: "uncovered"; post: PostData }
  | { type: "covered"; mission: MissionData; post: PostData }
  | { type: "notice"; mission: MissionData; post: PostData }
  | { type: "add_post" }
  | { type: "declare_absence"; suggestedStart: string; suggestedEnd: string }
  | null;

interface DropdownState {
  mission: MissionData;
  post: PostData;
  isSelf: boolean;
  x: number;
  y: number;
}

interface ConfirmState {
  title: string;
  body: string;
  onConfirm: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

function dayOffset(d: Date): number {
  return Math.floor((d.getTime() - RANGE_START.getTime()) / 86400000);
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d as string).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
}

interface MonthLabel { monthShort: string; year: string; isYearStart: boolean; offset: number; index: number }
function monthLabels(dayWidth: number): MonthLabel[] {
  const labels: MonthLabel[] = [];
  const cur = new Date(RANGE_START);
  cur.setDate(1);
  let index = 0;
  while (cur < RANGE_END) {
    labels.push({
      monthShort: cur.toLocaleDateString("fr-FR", { month: "short" }),
      year: cur.toLocaleDateString("fr-FR", { year: "2-digit" }),
      isYearStart: cur.getMonth() === 0,
      offset: dayOffset(cur) * dayWidth,
      index,
    });
    cur.setMonth(cur.getMonth() + 1);
    index++;
  }
  return labels;
}

// Facteur de saut des labels de mois selon le zoom (item 7 — lisibilité en vue condensée)
function monthSkipFor(zoom: Zoom): number {
  if (zoom === "triennial") return 3; // 1 mois sur 3
  if (zoom === "year") return 2;       // 1 mois sur 2
  return 1;                            // tous les mois
}

// Calcule le statut effectif en tenant compte des overrides locaux et des matches
function getEffectiveStatus(
  mission: MissionData,
  post: PostData,
  localStatuses: Record<string, string>
): string {
  const local = localStatuses[mission.id];
  if (local) return local;

  const stored = mission.briqueStatus;
  // Si le statut a été modifié manuellement (différent du défaut RECHERCHE), on l'utilise
  if (stored !== "RECHERCHE") return stored;

  // Sinon on calcule depuis les matches (comportement précédent)
  const hasMatch = mission.matchesA.length > 0 || mission.matchesB.length > 0;
  if (hasMatch) {
    const endDate = toDate(mission.endDate);
    if (endDate && post.noticeMonths > 0) {
      const noticeStart = new Date(endDate);
      noticeStart.setMonth(noticeStart.getMonth() - post.noticeMonths);
      if (new Date() >= noticeStart) return "PREAVIS";
    }
    return "CONFIRME";
  }
  return "RECHERCHE";
}

// ── Composant StatusDropdown ───────────────────────────────────────────────────

function StatusDropdown({
  dropdown,
  onSelect,
  onDetail,
  onClose,
}: {
  dropdown: DropdownState;
  onSelect: (status: string) => void;
  onDetail: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const statuses = getAvailableStatuses(dropdown.mission, dropdown.isSelf);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Ajustement pour ne pas sortir de l'écran
  const left = Math.min(dropdown.x, window.innerWidth - 200);
  const top  = Math.min(dropdown.y + 4, window.innerHeight - 280);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[180px]"
      style={{ left, top }}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
        Changer le statut
      </div>
      {statuses.map((s) => {
        const st = BRIQUE_STATUS[s];
        return (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition"
          >
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.bg}`} />
            <span className="text-gray-700">{st.label}</span>
          </button>
        );
      })}
      <div className="border-t border-gray-100 mt-1 pt-1">
        <button
          onClick={onDetail}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-kine-600 hover:bg-kine-50 transition font-medium"
        >
          Voir le détail →
        </button>
      </div>
    </div>
  );
}

// ── Modale choix zone non couverte (section 37.A) ────────────────────────────

interface UncoveredChoiceState {
  post: PostData;
  suggestedStart: string;
  suggestedEnd: string;
  absenceMissionId?: string; // présent si la zone provient d'une absence déclarée (item 1)
}

function UncoveredChoiceModal({
  modal,
  isEmployeur,
  onCreateMission,
  onClosePost,
  onDeleteAbsence,
  onClose,
}: {
  modal: UncoveredChoiceState;
  isEmployeur: boolean;
  onCreateMission: () => void;
  onClosePost: () => void;
  onDeleteAbsence: () => void;
  onClose: () => void;
}) {
  const createLabel = isEmployeur ? "Oui, ouvrir un poste" : "Oui, créer une annonce";

  return (
    <BottomSheet open onClose={onClose} zClass="z-[60]">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-xl">📅</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base leading-tight">
              {isEmployeur ? "Voulez-vous ouvrir un poste pour cette période ?" : "Voulez-vous proposer une annonce pour cette période ?"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{modal.post.label}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm text-gray-600">
          <p className="text-xs text-gray-400 mb-1">Période suggérée</p>
          <p className="font-medium">
            {new Date(modal.suggestedStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            {" → "}
            {new Date(modal.suggestedEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button onClick={onCreateMission} className="w-full">{createLabel} →</Button>
          <Button variant="outlined" onClick={onClosePost} className="w-full !py-2.5 !border-red-200 !text-red-600 hover:!bg-red-50">
            Non, fermer cette période
          </Button>
          {modal.absenceMissionId && (
            <Button variant="outlined" onClick={onDeleteAbsence} className="w-full !py-2.5 !border-[#1B3A5C]/30 !text-[#1B3A5C] hover:!bg-[#1B3A5C]/5">
              ↩ Je serai finalement présent — supprimer cette absence
            </Button>
          )}
          <Button variant="text" onClick={onClose} className="w-full !py-2 !text-gray-400 hover:!bg-gray-50">Annuler</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Composant ConfirmModal ─────────────────────────────────────────────────────

function ConfirmModal({ modal, onClose }: { modal: ConfirmState; onClose: () => void }) {
  return (
    <BottomSheet open onClose={onClose} zClass="z-[60]">
      <div className="p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-2">{modal.title}</h3>
        <p className="text-gray-600 text-sm mb-6">{modal.body}</p>
        <div className="flex gap-3">
          <Button variant="outlined" onClick={onClose} className="flex-1 !py-2.5">Annuler</Button>
          <Button onClick={modal.onConfirm} className="flex-1 !py-2.5 !bg-red-600 hover:!bg-red-700">Confirmer</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Composant MissionBrick ────────────────────────────────────────────────────

function MissionBrick({
  mission,
  post,
  dayWidth,
  effectiveStatus,
  isSelf,
  onBrickClick,
  onPanelClick,
}: {
  mission: MissionData;
  post: PostData;
  dayWidth: number;
  effectiveStatus: string;
  isSelf: boolean;
  onBrickClick: (mission: MissionData, post: PostData, isSelf: boolean, e: React.MouseEvent) => void;
  onPanelClick: (panel: Panel) => void;
}) {
  const start = toDate(mission.startDate);
  const end   = toDate(mission.endDate);
  if (!start || !end) return null;

  const left  = Math.max(dayOffset(start), 0) * dayWidth;
  const right = Math.min(dayOffset(end), TOTAL_DAYS) * dayWidth;
  const width = right - left;
  if (width <= 0) return null;

  const st = BRIQUE_STATUS[effectiveStatus] ?? BRIQUE_STATUS["RECHERCHE"];
  // Fermé volontairement → gris hachuré (section 47)
  const isHatch = effectiveStatus === "FERME";
  const brickColor = isHatch ? "timeline-hatch text-white" : `${st.bg} ${st.text}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelf) {
      // Self post : ouvre le panel directement
      onPanelClick({ type: "covered", mission, post });
    } else {
      // Autres briques : ouvre le menu contextuel
      onBrickClick(mission, post, false, e);
    }
  };

  // Activation clavier (Entrée / Espace) — accessibilité section 46
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (isSelf) {
      onPanelClick({ type: "covered", mission, post });
    } else {
      const r = e.currentTarget.getBoundingClientRect();
      onBrickClick(mission, post, false, {
        stopPropagation() {}, clientX: r.left, clientY: r.bottom,
      } as unknown as React.MouseEvent);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`absolute top-1 bottom-1 rounded-[6px] flex items-center px-2 cursor-pointer select-none overflow-hidden transition-[filter,box-shadow] duration-200 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] focus-visible:ring-offset-1 ${brickColor}`}
      style={{ left, width: Math.max(width, 24), position: "absolute" }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={`${mission.title} · ${fmtDate(mission.startDate)} → ${fmtDate(mission.endDate)} · ${st.label}`}
    >
      {/* Libellé masqué si brique trop petite (< 40px) — vue condensée (section 47) */}
      {Math.max(width, 24) >= 40 && (
        <span className="text-[11px] font-medium truncate">{mission.title}</span>
      )}
    </div>
  );
}

// ── Timeline row ───────────────────────────────────────────────────────────────

function TimelineRow({
  post, dayWidth, totalWidth, todayOffset,
  onUncoveredClick, onBrickClick, onPanelClick,
  localStatuses,
}: {
  post: PostData;
  dayWidth: number;
  totalWidth: number;
  todayOffset: number;
  localStatuses: Record<string, string>;
  onUncoveredClick: (post: PostData, clickedDate: Date) => void;
  onBrickClick: (mission: MissionData, post: PostData, isSelf: boolean, e: React.MouseEvent) => void;
  onPanelClick: (panel: Panel) => void;
}) {
  const now = new Date();
  const isSelf = post.id === "self";

  return (
    <div className="flex border-b border-gray-100 last:border-0" style={{ height: TRACK_HEIGHT }}>
      {/* Label fixe */}
      <div
        className="shrink-0 flex items-center px-3 border-r border-gray-100 bg-gray-50"
        style={{ width: LABEL_WIDTH }}
      >
        <div className="min-w-0">
          <span className="text-xs font-semibold text-gray-700 truncate block">{post.label}</span>
          {!post.isActive && !isSelf && (
            <span className="text-[9px] text-gray-400 font-medium">Fermé</span>
          )}
        </div>
      </div>

      {/* Piste */}
      <div className="relative flex-1 overflow-hidden bg-[var(--sable-chaud)]">
        <div className="relative" style={{ width: totalWidth, height: "100%" }}>
          {/* Segments NON_COUVERT calculés entre les missions */}
          {!isSelf && post.isActive && now.getTime() < RANGE_END.getTime() &&
            computeUncoveredGaps(post.missions).map((gap, gi) => {
              const gLeft  = Math.max(dayOffset(gap.start), 0) * dayWidth;
              const gRight = Math.min(dayOffset(gap.end), TOTAL_DAYS) * dayWidth;
              const gWidth = gRight - gLeft;
              if (gWidth <= 0) return null;
              const u = uncoveredUrgency(gap.start);
              const gDays = daysUntil(gap.start);
              return (
                <div
                  key={`gap-${gi}`}
                  role="button"
                  tabIndex={0}
                  className={`absolute top-1 bottom-1 rounded-[6px] cursor-pointer transition-[filter,box-shadow] duration-200 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] focus-visible:ring-offset-1 ${u.cls} ${u.urgent ? "motion-safe:animate-pulse" : ""}`}
                  style={{ left: gLeft, width: Math.max(gWidth, 4) }}
                  onClick={() => onUncoveredClick(post, gap.start)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onUncoveredClick(post, gap.start); }
                  }}
                  title={`Non couvert — commence dans ${gDays} j · ${u.label}`}
                />
              );
            })
          }

          {/* Briques missions */}
          {post.missions.map(m => (
            <MissionBrick
              key={m.id}
              mission={m}
              post={post}
              dayWidth={dayWidth}
              effectiveStatus={isSelf ? "PRESENT" : getEffectiveStatus(m, post, localStatuses)}
              isSelf={isSelf}
              onBrickClick={onBrickClick}
              onPanelClick={onPanelClick}
            />
          ))}

          {/* Ligne aujourd'hui — lagon profond, pulsation douce (section 46) */}
          <div
            className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-10 pointer-events-none"
            style={{ left: todayOffset }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Ligne titulaire segmentée ──────────────────────────────────────────────────

function SelfTimelineRow({
  selfMissions, cabinetName, dayWidth, totalWidth, todayOffset,
  onPresenceClick, onAbsenceClick,
}: {
  selfMissions: SelfMission[];
  cabinetName: string;
  dayWidth: number;
  totalWidth: number;
  todayOffset: number;
  onPresenceClick: (start: string, end: string) => void;
  onAbsenceClick: (mission: SelfMission) => void;
}) {
  const segments = computeSelfSegments(selfMissions);

  return (
    <div className="flex border-b border-gray-100" style={{ height: TRACK_HEIGHT }}>
      <div
        className="shrink-0 flex items-center px-3 border-r border-gray-100 bg-gray-50"
        style={{ width: LABEL_WIDTH }}
      >
        <span className="text-xs font-semibold text-gray-700 truncate block">{cabinetName} (titulaire)</span>
      </div>
      <div className="relative flex-1 overflow-hidden bg-[var(--sable-chaud)]">
        <div className="relative" style={{ width: totalWidth, height: "100%" }}>
          {segments.map((seg, i) => {
            const left  = Math.max(dayOffset(seg.start), 0) * dayWidth;
            const right = Math.min(dayOffset(seg.end), TOTAL_DAYS) * dayWidth;
            const w = right - left;
            if (w <= 0) return null;

            if (seg.kind === "presence") {
              const openPresence = () => onPresenceClick(
                seg.start.toISOString().slice(0, 10),
                seg.end.toISOString().slice(0, 10)
              );
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  className="absolute top-1 bottom-1 bg-[var(--bleu-marine)] text-white rounded-[6px] flex items-center px-2 cursor-pointer select-none overflow-hidden transition-[filter,box-shadow] duration-200 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] focus-visible:ring-offset-1"
                  style={{ left, width: Math.max(w, 24) }}
                  onClick={openPresence}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPresence(); } }}
                  title="Présence — cliquez pour déclarer une absence"
                >
                  {Math.max(w, 24) >= 40 && (
                    <span className="text-[11px] font-medium truncate">Présence</span>
                  )}
                </div>
              );
            }

            const st = seg.covered ? BRIQUE_STATUS["CONFIRME"] : BRIQUE_STATUS["NON_COUVERT"];
            const typeLabel = BRIQUE_STATUS[seg.mission.briqueStatus]?.label ?? "Absent";
            const displayLabel = seg.covered ? `Couvert · ${typeLabel}` : typeLabel;

            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                className={`absolute top-1 bottom-1 ${st.bg} ${st.text} rounded-[6px] flex items-center px-2 cursor-pointer select-none overflow-hidden transition-[filter,box-shadow] duration-200 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] focus-visible:ring-offset-1`}
                style={{ left, width: Math.max(w, 24) }}
                onClick={() => onAbsenceClick(seg.mission)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbsenceClick(seg.mission); } }}
                title={`${displayLabel} · ${fmtDate(seg.mission.startDate)} → ${fmtDate(seg.mission.endDate)}`}
              >
                {Math.max(w, 24) >= 40 && (
                  <span className="text-[11px] font-medium truncate">{displayLabel}</span>
                )}
              </div>
            );
          })}
          {/* Ligne aujourd'hui — lagon profond, pulsation douce (section 46) */}
          <div className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-10 pointer-events-none" style={{ left: todayOffset }} />
        </div>
      </div>
    </div>
  );
}

// ── Panel latéral droit ────────────────────────────────────────────────────────

function SidePanel({
  panel, onClose, onClosePost, isEmployeur,
}: {
  panel: NonNullable<Panel>;
  onClose: () => void;
  onClosePost: (post: PostData) => void;
  isEmployeur: boolean;
}) {
  const router = useRouter();

  if (panel.type === "declare_absence") {
    return (
      <DeclareAbsenceForm
        suggestedStart={panel.suggestedStart}
        suggestedEnd={panel.suggestedEnd}
        onClose={onClose}
        onCreated={() => { onClose(); router.refresh(); }}
      />
    );
  }

  if (panel.type === "add_post") {
    return <AddPostForm onClose={onClose} isEmployeur={isEmployeur} onCreated={() => { onClose(); router.refresh(); }} />;
  }

  if (panel.type === "uncovered") {
    const post = panel.post;
    const latestMission = post.missions.sort(
      (a, b) => new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime()
    )[0];

    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-bold mb-2">NON COUVERT</span>
          <h3 className="font-bold text-gray-900">{post.label}</h3>
        </div>
        {latestMission ? (
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-1">{latestMission.title}</p>
            <p className="text-xs">{fmtDate(latestMission.startDate)} → {fmtDate(latestMission.endDate)}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucune annonce publiée pour ce poste.</p>
        )}
        {latestMission && (
          <Link
            href={`/annonces?missionId=${latestMission.id}`}
            className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold text-center hover:bg-kine-700 transition"
          >
            Swiper les candidats →
          </Link>
        )}
        <Link
          href="/missions/create"
          className="w-full py-3 border border-kine-200 text-kine-700 rounded-xl text-sm font-semibold text-center hover:bg-kine-50 transition"
        >
          + Publier une annonce
        </Link>
        <Link
          href="/matches"
          className="w-full py-3 border border-kine-200 text-kine-700 rounded-xl text-sm font-semibold text-center hover:bg-kine-50 transition"
        >
          Voir tous les matchs
        </Link>
        {post.isActive && (
          <button
            onClick={() => onClosePost(post)}
            className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition mt-2"
          >
            Fermer ce poste
          </button>
        )}
      </div>
    );
  }

  if (panel.type === "notice") {
    const { mission, post } = panel;
    const endDate = toDate(mission.endDate);
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold mb-2">PRÉAVIS</span>
          <h3 className="font-bold text-gray-900">{post.label}</h3>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
          <p className="font-semibold text-yellow-800">Préavis de {post.noticeMonths} mois</p>
          {endDate && <p className="text-yellow-700 text-xs mt-1">Fin de contrat : {fmtDate(endDate)}</p>}
          <p className="text-yellow-600 text-xs mt-1">Pensez à recruter un remplaçant.</p>
        </div>
        <Link
          href="/missions/create"
          className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold text-center hover:bg-kine-700 transition"
        >
          Publier une annonce pré-remplie
        </Link>
        {post.isActive && (
          <button
            onClick={() => onClosePost(post)}
            className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
          >
            Fermer ce poste
          </button>
        )}
      </div>
    );
  }

  if (panel.type === "covered") {
    const { mission, post } = panel;
    const match = mission.matchesA[0] || mission.matchesB[0];
    const them = match
      ? (mission.matchesA[0] ? match.profileB : match.profileA)
      : null;
    const isFinished = toDate(mission.endDate) ? new Date() > toDate(mission.endDate)! : false;

    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold mb-2">COUVERT</span>
          <h3 className="font-bold text-gray-900">{post.label}</h3>
        </div>
        {them && (
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-0.5">Remplaçant</p>
            <p className="font-bold text-gray-900">{them.name ?? "Sans nom"}</p>
          </div>
        )}
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
          <p>{fmtDate(mission.startDate)} → {fmtDate(mission.endDate)}</p>
          {mission.statusNote && (
            <p className="mt-1 text-gray-600 italic">{mission.statusNote}</p>
          )}
        </div>
        {match && (
          <Link
            href={`/match/${match.id}`}
            className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold text-center hover:bg-kine-700 transition"
          >
            Recontacter →
          </Link>
        )}
        {isFinished && match && (
          <Link
            href={`/match/${match.id}?rate=1`}
            className="w-full py-3 border border-yellow-300 text-yellow-700 rounded-xl text-sm font-semibold text-center hover:bg-yellow-50 transition"
          >
            Recommander
          </Link>
        )}
        {post.isActive && (
          <button
            onClick={() => onClosePost(post)}
            className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition mt-2"
          >
            Fermer ce poste
          </button>
        )}
        {!post.isActive && (
          <p className="text-xs text-gray-400 text-center">Ce poste est fermé.</p>
        )}
      </div>
    );
  }

  return null;
}

// ── Formulaire déclaration d'absence ──────────────────────────────────────────

const ABSENCE_OPTIONS = [
  { value: "ABSENT_CONGE",     label: "Congés",        briqueStatus: "ABSENT_CONGE"     },
  { value: "ABSENT_FORMATION", label: "Formation",     briqueStatus: "ABSENT_FORMATION" },
  { value: "ABSENT_MALADIE",   label: "Arrêt maladie", briqueStatus: "ABSENT_MALADIE"   },
  { value: "AUTRE",            label: "Autre",         briqueStatus: "ABSENT_CONGE"     },
];

function DeclareAbsenceForm({ suggestedStart, suggestedEnd, onClose, onCreated }: {
  suggestedStart: string;
  suggestedEnd: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [absenceType, setAbsenceType] = useState("ABSENT_CONGE");
  const [startDate, setStartDate]     = useState(suggestedStart);
  const [endDate, setEndDate]         = useState(suggestedEnd);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const selected = ABSENCE_OPTIONS.find(o => o.value === absenceType) ?? ABSENCE_OPTIONS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        absenceType: selected.briqueStatus,
        title: selected.label,
        startDate,
        endDate,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Erreur lors de la création.");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold mb-2">VACANCE</span>
        <h3 className="font-bold text-gray-900">Déclarer une absence</h3>
        <p className="text-xs text-gray-500 mt-0.5">La période sera marquée NON COUVERTE jusqu&apos;à trouver un remplaçant.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Type d&apos;absence</label>
        <select
          value={absenceType}
          onChange={e => setAbsenceType(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        >
          {ABSENCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Date de début</label>
        <input
          type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Date de fin</label>
        <input
          type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="md3-ripple flex-1 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
          {loading ? "…" : "Valider"}
        </button>
      </div>
    </form>
  );
}

// ── Formulaire ajout poste ─────────────────────────────────────────────────────

function AddPostForm({ onClose, onCreated, isEmployeur }: { onClose: () => void; onCreated: () => void; isEmployeur: boolean }) {
  const [label, setLabel] = useState("");
  const [postType, setPostType] = useState("REMPLACEMENT_REGULIER");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/cabinet-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), postType }),
    });
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="font-bold text-gray-900">Ajouter un poste</h3>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Libellé du poste</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={60}
          required
          placeholder='Ex : "Poste 2", "Dr Marie L."'
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
        <select
          value={postType}
          onChange={e => setPostType(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
        >
          <option value="REMPLACEMENT_REGULIER">{isEmployeur ? "Vacation régulière" : "Remplacement ponctuel"}</option>
          <option value="ASSISTANT">{isEmployeur ? "Poste salarié (CDD)" : "Assistanat (long terme)"}</option>
          <option value="COLLABORATION">{isEmployeur ? "CDI" : "Collaboration libérale"}</option>
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Annuler</button>
        <button type="submit" disabled={loading || !label.trim()} className="md3-ripple flex-1 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
          {loading ? "…" : "Créer"}
        </button>
      </div>
    </form>
  );
}

// ── PlanningBoard principal ────────────────────────────────────────────────────

export default function PlanningBoard({ posts, cabinetName, isEmployeur, selfMissions }: Props) {
  const router = useRouter();
  const [zoom, setZoom]         = useState<Zoom>("quarter");
  const [panel, setPanel]       = useState<Panel>(null);
  const [dropdown, setDropdown] = useState<DropdownState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
  const [uncoveredChoice, setUncoveredChoice] = useState<UncoveredChoiceState | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const containerWidth = typeof window !== "undefined" ? Math.min(window.innerWidth - LABEL_WIDTH - 40, 900) : 700;
  const dayWidth   = containerWidth / ZOOM_DAYS[zoom];
  const totalWidth = TOTAL_DAYS * dayWidth;
  const todayOff   = dayOffset(new Date()) * dayWidth;
  const mLabels    = monthLabels(dayWidth);
  const monthSkip  = monthSkipFor(zoom);
  const todayFull  = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const rowsScrollRef = useRef<HTMLDivElement>(null);

  // Item 3 — scroll initial centré sur "aujourd'hui"
  useEffect(() => {
    const el = rowsScrollRef.current;
    if (!el) return;
    const target = Math.max(0, LABEL_WIDTH + todayOff - el.clientWidth / 2);
    el.scrollLeft = target;
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, target - LABEL_WIDTH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Appliquer un statut sur une mission (avec optimistic update)
  const applyStatus = useCallback(async (missionId: string, status: string) => {
    setLocalStatuses(prev => ({ ...prev, [missionId]: status }));
    setDropdown(null);
    setConfirmModal(null);

    await fetch(`/api/missions/${missionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briqueStatus: status }),
    });
  }, []);

  // Demander un changement de statut (avec confirmation si nécessaire)
  function requestStatusChange(mission: MissionData, status: string) {
    setDropdown(null);

    if (status === "FERME") {
      setConfirmModal({
        title: "Fermer ce créneau",
        body: "Cette action marque le créneau comme fermé. Vous pourrez le réouvrir en modifiant son statut.",
        onConfirm: () => applyStatus(mission.id, "FERME"),
      });
    } else if (status === "PREAVIS") {
      const match = mission.matchesA[0] || mission.matchesB[0];
      const them = match ? (mission.matchesA[0] ? match.profileB : match.profileA) : null;
      const name = them?.name ?? "le remplaçant";
      setConfirmModal({
        title: "Passer en préavis",
        body: `Confirmer le départ de ${name} ?`,
        onConfirm: () => applyStatus(mission.id, "PREAVIS"),
      });
    } else {
      applyStatus(mission.id, status);
    }
  }

  // Ouvrir le dropdown au clic sur une brique
  function openDropdown(mission: MissionData, post: PostData, isSelf: boolean, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropdown({ mission, post, isSelf, x: rect.left, y: rect.bottom });
    setPanel(null);
  }

  // Fermer un poste entier (cascade ANNULE)
  function requestClosePost(post: PostData) {
    setPanel(null);
    setConfirmModal({
      title: "Fermer ce poste",
      body: "Vous êtes sûr ? Cette action suspend le poste et annule toutes les missions liées.",
      onConfirm: async () => {
        setConfirmModal(null);
        await fetch(`/api/cabinet-posts/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });
        router.refresh();
      },
    });
  }

  const allRows: PostData[] = posts;

  function handlePresenceSegmentClick(start: string, end: string) {
    setDropdown(null);
    setPanel({ type: "declare_absence", suggestedStart: start, suggestedEnd: end });
  }

  function handleAbsenceSegmentClick(mission: SelfMission) {
    setDropdown(null);
    setPanel(null);
    const covered = mission.matchesA.length > 0 || mission.matchesB.length > 0;
    if (covered) {
      const fakeSelfPost: PostData = {
        id: "self", label: `${cabinetName} (titulaire)`,
        postType: "REMPLACEMENT_REGULIER", noticeMonths: 0, isActive: true, missions: [],
      };
      const mData: MissionData = {
        ...mission, isActive: true, missionType: "REMPLACEMENT",
        statusUpdatedAt: null, statusNote: null,
      };
      setPanel({ type: "covered", mission: mData, post: fakeSelfPost });
    } else {
      const suggestedStart = toDate(mission.startDate)?.toISOString().slice(0, 10) ?? "";
      const suggestedEnd   = toDate(mission.endDate)?.toISOString().slice(0, 10) ?? "";
      const fakeSelfPost: PostData = {
        id: "self", label: `${cabinetName} (titulaire)`,
        postType: "REMPLACEMENT_REGULIER", noticeMonths: 0, isActive: true, missions: [],
      };
      setUncoveredChoice({ post: fakeSelfPost, suggestedStart, suggestedEnd, absenceMissionId: mission.id });
    }
  }

  // Item 1 — "Je serai finalement présent" : supprime l'absence isSelfPresence
  async function handleDeleteAbsence(missionId: string) {
    setUncoveredChoice(null);
    await fetch(`/api/absences?id=${encodeURIComponent(missionId)}`, { method: "DELETE" });
    router.refresh();
  }

  // Bandeau d'alerte — calcul client au chargement (section 47).
  // Postes actifs dont la 1ère zone non couverte tombe dans ≤ 90 jours.
  const alertList = allRows
    .filter(p => p.isActive)
    .map(p => {
      const gaps = computeUncoveredGaps(p.missions);
      if (gaps.length === 0) return null;
      const soonest = gaps.reduce((min, g) => (g.start < min ? g.start : min), gaps[0].start);
      return { post: p, days: daysUntil(soonest) };
    })
    .filter((a): a is { post: PostData; days: number } => a !== null && a.days <= 90)
    .sort((a, b) => a.days - b.days);
  const topAlert = alertList[0] ?? null;
  const alertIsRed = topAlert !== null && topAlert.days < 30;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Bandeau d'alerte contextuel (section 47) */}
      {topAlert && (
        <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2 text-xs font-semibold ${
          alertIsRed ? "bg-red-50 text-red-700 border-b border-red-200" : "bg-orange-50 text-orange-800 border-b border-orange-200"
        }`}>
          <span className="truncate">
            {alertIsRed ? "⚠" : "📅"}{" "}
            {alertList.length > 1
              ? `${alertList.length} postes ${alertIsRed ? "non couverts" : "sans couverture confirmée"} dans moins de 3 mois`
              : alertIsRed
                ? (topAlert.days <= 0
                    ? `${topAlert.post.label} non couvert dès aujourd'hui`
                    : `${topAlert.post.label} non couvert dans ${topAlert.days} jour${topAlert.days > 1 ? "s" : ""}`)
                : `${topAlert.post.label} sans couverture dans ${Math.max(1, Math.round(topAlert.days / 7))} semaine${Math.round(topAlert.days / 7) > 1 ? "s" : ""}`}
          </span>
          <button
            onClick={() => { setDropdown(null); setPanel({ type: "uncovered", post: topAlert.post }); }}
            className={`ml-auto shrink-0 px-3 py-1 rounded-lg font-bold text-white transition ${
              alertIsRed ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            Voir le poste
          </button>
        </div>
      )}
      {/* Modals */}
      {confirmModal && (
        <ConfirmModal
          modal={confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Modale choix zone non couverte */}
      {uncoveredChoice && (
        <UncoveredChoiceModal
          modal={uncoveredChoice}
          isEmployeur={isEmployeur}
          onCreateMission={() => {
            const { suggestedStart, suggestedEnd } = uncoveredChoice;
            setUncoveredChoice(null);
            router.push(`/missions/create?startDate=${encodeURIComponent(suggestedStart)}&endDate=${encodeURIComponent(suggestedEnd)}`);
          }}
          onDeleteAbsence={() => { if (uncoveredChoice.absenceMissionId) handleDeleteAbsence(uncoveredChoice.absenceMissionId); }}
          onClosePost={() => {
            const post = uncoveredChoice.post;
            setUncoveredChoice(null);
            if (post.id === "self") return;
            setConfirmModal({
              title: "Fermer cette période",
              body: "Cette période sera marquée non disponible à la réservation. Le poste sera suspendu.",
              onConfirm: async () => {
                setConfirmModal(null);
                await fetch(`/api/cabinet-posts/${post.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isActive: false }),
                });
                router.refresh();
              },
            });
          }}
          onClose={() => setUncoveredChoice(null)}
        />
      )}

      {/* Dropdown statut */}
      {dropdown && (
        <StatusDropdown
          dropdown={dropdown}
          onSelect={(s) => requestStatusChange(dropdown.mission, s)}
          onDetail={() => {
            setDropdown(null);
            const hasMatch = dropdown.mission.matchesA.length > 0 || dropdown.mission.matchesB.length > 0;
            if (hasMatch) setPanel({ type: "covered", mission: dropdown.mission, post: dropdown.post });
            else setPanel({ type: "uncovered", post: dropdown.post });
          }}
          onClose={() => setDropdown(null)}
        />
      )}

      {/* ── En-tête ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Mon Planning</h1>
          <p className="text-xs text-gray-400">{posts.length} poste{posts.length !== 1 ? "s" : ""} · {cabinetName}</p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["month", "quarter", "year", "triennial"] as Zoom[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`md3-ripple px-3 py-1 rounded-lg text-xs font-semibold transition ${
                zoom === z ? "bg-white text-kine-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
            setPanel({ type: "declare_absence", suggestedStart: today, suggestedEnd: inTwoWeeks });
            setDropdown(null);
          }}
          className="md3-ripple px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition flex items-center gap-1"
        >
          + Déclarer une absence
        </button>

        <button
          onClick={() => { setPanel({ type: "add_post" }); setDropdown(null); }}
          className="md3-ripple px-3 py-2 bg-kine-600 text-white rounded-xl text-xs font-bold hover:bg-kine-700 transition flex items-center gap-1"
        >
          + Ajouter un poste
        </button>
      </div>

      {/* ── Corps : timeline + panel ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Timeline */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* En-tête mois */}
          <div className="flex flex-shrink-0 border-b border-gray-200 bg-white">
            <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} className="border-r border-gray-100 bg-gray-50" />
            <div className="overflow-hidden flex-1" ref={scrollRef}>
              <div className="relative h-7" style={{ width: totalWidth }}>
                {mLabels.map((m) => {
                  // Item 7 : en vue condensée, 1 mois sur 2/3 ; janvier toujours affiché (changement d'année)
                  if (m.index % monthSkip !== 0 && !m.isYearStart) return null;
                  return (
                    <div key={m.index} className="absolute top-0 bottom-0 flex items-center" style={{ left: m.offset }}>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lagon-profond)]/80 pl-1 whitespace-nowrap">
                        {m.monthShort}{m.isYearStart ? ` ${m.year}` : ""}
                      </span>
                      <div className="absolute top-0 bottom-0 left-0 w-px bg-gray-200" />
                    </div>
                  );
                })}
                {/* Signature sections 46-47 — "aujourd'hui" comme flèche de progression :
                    trait lagon pulsant + triangle ▶ pointant vers le futur + label flottant. */}
                <div
                  className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-20 cursor-help"
                  style={{ left: todayOff }}
                  title={`Aujourd'hui — ${todayFull}`}
                >
                  {/* Label "auj." flottant au-dessus */}
                  <span className="absolute top-0.5 left-1.5 text-[9px] font-bold tracking-wide text-[var(--lagon-profond)] whitespace-nowrap">auj.</span>
                  {/* Triangle ▶ centré sur la ligne, pointant vers la droite (le futur) */}
                  <div className="planning-today-marker absolute top-1/2 -translate-y-1/2 left-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-[var(--lagon-profond)]" />
                </div>
              </div>
            </div>
          </div>

          {/* Lignes */}
          <div
            ref={rowsScrollRef}
            className="flex-1 overflow-y-auto overflow-x-auto pr-6"
            onScroll={(e) => {
              // Synchronise l'en-tête des mois avec le défilement horizontal des lignes
              if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, e.currentTarget.scrollLeft - LABEL_WIDTH);
            }}
          >
            <div style={{ minWidth: totalWidth + LABEL_WIDTH }}>
              <SelfTimelineRow
                selfMissions={selfMissions}
                cabinetName={cabinetName}
                dayWidth={dayWidth}
                totalWidth={totalWidth}
                todayOffset={todayOff}
                onPresenceClick={handlePresenceSegmentClick}
                onAbsenceClick={handleAbsenceSegmentClick}
              />
              {allRows.map(post => (
                <TimelineRow
                  key={post.id}
                  post={post}
                  dayWidth={dayWidth}
                  totalWidth={totalWidth}
                  todayOffset={todayOff}
                  localStatuses={localStatuses}
                  onUncoveredClick={(p, clickedDate) => {
                    setDropdown(null);
                    setPanel(null);
                    const start = clickedDate.toISOString().slice(0, 10);
                    const endDate = new Date(clickedDate);
                    endDate.setDate(endDate.getDate() + 30);
                    const end = endDate.toISOString().slice(0, 10);
                    setUncoveredChoice({ post: p, suggestedStart: start, suggestedEnd: end });
                  }}
                  onBrickClick={openDropdown}
                  onPanelClick={(p) => { setPanel(p); setDropdown(null); }}
                />
              ))}

              {allRows.length === 0 && (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  <div className="text-center">
                    <p className="mb-2">Aucun poste configuré</p>
                    <button
                      onClick={() => setPanel({ type: "add_post" })}
                      className="px-4 py-2 bg-kine-600 text-white rounded-xl text-xs font-bold hover:bg-kine-700 transition"
                    >
                      + Ajouter un poste
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Légende */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-2 flex items-center gap-4 overflow-x-auto">
            {[
              { color: "bg-[var(--bleu-marine)]",   label: "Titulaire" },
              { color: "bg-[var(--vert-palme)]",    label: "Confirmé" },
              { color: "bg-[var(--ambre)]",         label: "Recrutement" },
              { color: "bg-[var(--ambre)]",         label: "Préavis" },
              { color: "bg-gray-700",               label: "Fermé" },
              { color: "bg-[#E8633D]/20 border border-[#E8633D]/40", label: "Non couvert" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-3 h-3 rounded-[3px] ${l.color}`} />
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel latéral droit */}
        {panel && (
          <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Détail</span>
                <button onClick={() => setPanel(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>
              <SidePanel
                panel={panel}
                onClose={() => setPanel(null)}
                onClosePost={requestClosePost}
                isEmployeur={isEmployeur}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
