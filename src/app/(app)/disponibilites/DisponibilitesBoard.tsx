"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MissionSlot {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  briqueStatus: string;
  missionType: string;
}

interface Props {
  profileName: string | null;
  profileType: "REMPLACANT" | "ASSISTANT";
  profileLocation: string;
  missions: MissionSlot[];
}

// ── Constantes timeline ────────────────────────────────────────────────────────

type Zoom = "month" | "quarter" | "year" | "triennial";
const ZOOM_DAYS: Record<Zoom, number> = { month: 30, quarter: 91, year: 365, triennial: 730 };
const ZOOM_LABELS: Record<Zoom, string> = { month: "Mois", quarter: "Trimestre", year: "Année", triennial: "2 ans" };
const TRACK_HEIGHT = 56;
const LABEL_WIDTH = 140;

const RANGE_START = new Date();
RANGE_START.setMonth(RANGE_START.getMonth() - 1);
RANGE_START.setDate(1);
RANGE_START.setHours(0, 0, 0, 0);

const RANGE_END = new Date(RANGE_START);
RANGE_END.setMonth(RANGE_END.getMonth() + 18);

const TOTAL_DAYS = Math.ceil((RANGE_END.getTime() - RANGE_START.getTime()) / 86400000);

// ── Styles par statut ──────────────────────────────────────────────────────────

// Palette sections 46-47 — tokens partagés avec le Planning Board.
// Texte sombre sur orange-vif (#3D1A02) : contraste AA vérifié.
const SLOT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  RECHERCHE:    { bg: "bg-[var(--ambre)]",      text: "text-[#3D2A08]", label: "Disponible" },
  CONFIRME:     { bg: "bg-[var(--vert-palme)]", text: "text-white",     label: "Confirmé" },
  EN_ATTENTE:   { bg: "bg-[var(--orange-vif)]", text: "text-[#3D1A02]", label: "En attente" },
  INDISPONIBLE: { bg: "timeline-hatch",         text: "text-white",     label: "Indisponible" },
  ANNULE:       { bg: "bg-gray-300",            text: "text-gray-600",  label: "Annulé" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function dayOffset(d: Date): number {
  return Math.floor((d.getTime() - RANGE_START.getTime()) / 86400000);
}

function daysUntil(d: Date): number {
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

// Vue verticale mobile : fenêtre ~6 mois autour d'aujourd'hui (briques lisibles)
const MOBILE_WINDOW_DAYS = 183;
function mobileWindow(): { start: Date; end: Date } {
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 15);
  const end = new Date(start); end.setDate(end.getDate() + MOBILE_WINDOW_DAYS);
  return { start, end };
}
function pctIn(d: Date, start: Date, end: Date): number {
  const span = (end.getTime() - start.getTime()) / 86400000;
  return Math.max(0, Math.min(((d.getTime() - start.getTime()) / 86400000 / span) * 100, 100));
}

function monthLabels(dayWidth: number): { label: string; offset: number; index: number; isYearStart: boolean }[] {
  const labels = [];
  const cur = new Date(RANGE_START);
  cur.setDate(1);
  let index = 0;
  while (cur < RANGE_END) {
    labels.push({
      label: cur.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      offset: dayOffset(cur) * dayWidth,
      index,
      isYearStart: cur.getMonth() === 0,
    });
    cur.setMonth(cur.getMonth() + 1);
    index++;
  }
  return labels;
}

// Saut des labels de mois selon le zoom (section 89) — évite la fusion des labels
// en vue large : 1 mois sur 3 (trimestre) en "2 ans", 1 sur 2 en "Année".
function monthSkipFor(zoom: Zoom): number {
  if (zoom === "triennial") return 3;
  if (zoom === "year") return 2;
  return 1;
}

// ── Modale choix zone libre ────────────────────────────────────────────────────

interface FreeZoneModal {
  suggestedStart: string;
  suggestedEnd: string;
}

function FreeZoneChoiceModal({
  modal,
  onOpenDispo,
  onBlockDates,
  onClose,
}: {
  modal: FreeZoneModal;
  onOpenDispo: () => void;
  onBlockDates: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-kine-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-xl">📅</span>
          </div>
          <h3 className="font-bold text-gray-900 text-base leading-tight">
            Ouvrir cette période à la réservation ?
          </h3>
        </div>

        {/* Pas de durée présupposée (section 88) — la fin sera précisée à l'écran suivant */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-600">
          <p className="font-medium">
            Disponible à partir du{" "}
            {new Date(modal.suggestedStart).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onOpenDispo}
            className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition disabled:opacity-40"
          >
            Oui, je suis disponible →
          </button>
          <button
            onClick={onBlockDates}
            className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
          >
            Non, bloquer ces dates
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Brique d'une période ───────────────────────────────────────────────────────

function SlotBrick({
  slot,
  dayWidth,
  onEdit,
}: {
  slot: MissionSlot;
  dayWidth: number;
  onEdit: (slot: MissionSlot) => void;
}) {
  const start = toDate(slot.startDate);
  const end   = toDate(slot.endDate);
  if (!start || !end) return null;

  const left  = Math.max(dayOffset(start), 0) * dayWidth;
  const right = Math.min(dayOffset(end), TOTAL_DAYS) * dayWidth;
  const width = right - left;
  if (width <= 0) return null;

  const st = SLOT_STYLES[slot.briqueStatus] ?? SLOT_STYLES["RECHERCHE"];

  return (
    <button
      type="button"
      onClick={() => onEdit(slot)}
      className={`absolute top-1.5 bottom-1.5 rounded-[6px] flex items-center px-2.5 select-none overflow-hidden cursor-pointer transition-[filter,box-shadow] duration-200 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] ${st.bg} ${st.text}`}
      style={{ left, width: Math.max(width, 28) }}
      title={`${slot.title} · ${st.label} — cliquez pour modifier`}
    >
      {/* Libellé masqué si brique trop petite (< 40px) — vue condensée (section 47) */}
      {Math.max(width, 28) >= 40 && (
        <span className="text-[11px] font-semibold truncate">{slot.title}</span>
      )}
    </button>
  );
}

// Modale d'édition d'une disponibilité (section 64 — toute brique reste modifiable)
function SlotEditModal({ slot, onClose, onSaved }: {
  slot: MissionSlot; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(slot.title);
  const [start, setStart] = useState(toDate(slot.startDate)?.toISOString().slice(0, 10) ?? "");
  const [end, setEnd]     = useState(toDate(slot.endDate)?.toISOString().slice(0, 10) ?? "");
  const [busy, setBusy]   = useState(false);

  async function save() {
    if (!start || !end || busy) return;
    setBusy(true);
    await fetch(`/api/missions/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(title.trim().length >= 3 ? { title: title.trim() } : {}),
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
      }),
    });
    onSaved();
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/missions/${slot.id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
        <h3 className="font-bold text-gray-900 text-base mb-4">Modifier la période</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Intitulé</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Début</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fin</label>
            <input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={remove} disabled={busy}
              className="px-3 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition disabled:opacity-40">
              Supprimer
            </button>
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40">
              Annuler
            </button>
            <button onClick={save} disabled={!start || !end || busy}
              className="flex-1 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition disabled:opacity-40">
              {busy ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DisponibilitesBoard principal ─────────────────────────────────────────────

export default function DisponibilitesBoard({ profileName, profileType, profileLocation, missions }: Props) {
  const router = useRouter();
  const isAssistant = profileType === "ASSISTANT";

  const [zoom, setZoom] = useState<Zoom>("quarter");
  const [freeZoneModal, setFreeZoneModal] = useState<FreeZoneModal | null>(null);
  const [editSlot, setEditSlot] = useState<MissionSlot | null>(null);
  const [blocking, setBlocking] = useState(false);

  // Largeur réactive (mobile-first) — se recalcule au resize / rotation
  const [winW, setWinW] = useState(800);
  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile   = winW < 640;
  const labelWidth = isMobile ? 96 : LABEL_WIDTH;
  // Piste = 90% de l'espace disponible après la colonne de labels (section 87)
  const containerWidth = Math.min((winW - labelWidth) * 0.9, 900);
  const dayWidth   = containerWidth / ZOOM_DAYS[zoom];
  const totalWidth = TOTAL_DAYS * dayWidth;
  const todayOff   = dayOffset(new Date()) * dayWidth;
  const todayFull  = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const mLabels    = useMemo(() => monthLabels(dayWidth), [dayWidth]);
  const monthSkip  = monthSkipFor(zoom);

  // Scroll horizontal : en-tête des mois synchronisé au corps + position initiale
  // "aujourd'hui" à ~10% depuis la gauche (section 87), 90% pour le futur.
  const monthHeaderRef = useRef<HTMLDivElement>(null);
  const rowsScrollRef  = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rowsScrollRef.current;
    if (!el || isMobile) return;
    const id = requestAnimationFrame(() => {
      // "Aujourd'hui" à ~10% de la piste visible APRÈS la colonne label sticky
      // (sections 87 + 90), sans passer sous le label figé.
      const target = Math.max(0, todayOff - (el.clientWidth - labelWidth) * 0.1);
      el.scrollLeft = target;
      if (monthHeaderRef.current) monthHeaderRef.current.scrollLeft = Math.max(0, target - labelWidth);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, labelWidth, isMobile, winW]);
  // Fenêtre mobile ~6 mois
  const mWin = mobileWindow();
  const mpct = (d: Date) => pctIn(d, mWin.start, mWin.end);
  const fmtShort = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });

  // Bandeau d'alerte remplaçant (section 47) — période ouverte (Disponible, sans
  // match) qui commence dans ≤ 90 jours. Calcul client sur les données présentes.
  const openAlert = useMemo(() => {
    const open = missions
      .filter(m => m.briqueStatus === "RECHERCHE")
      .map(m => {
        const s = toDate(m.startDate);
        return s ? { slot: m, days: daysUntil(s) } : null;
      })
      .filter((a): a is { slot: MissionSlot; days: number } => a !== null && a.days >= 0 && a.days <= 90)
      .sort((a, b) => a.days - b.days);
    return open[0] ?? null;
  }, [missions]);
  const alertIsRed = openAlert !== null && openAlert.days < 30;

  const handleFreeZoneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const dayIndex = Math.max(0, Math.floor(relX / dayWidth));
    const startDate = new Date(RANGE_START.getTime() + dayIndex * 86400000);
    const endDate   = new Date(startDate);
    endDate.setDate(endDate.getDate() + (isAssistant ? 90 : 30));

    setFreeZoneModal({
      suggestedStart: startDate.toISOString().slice(0, 10),
      suggestedEnd:   endDate.toISOString().slice(0, 10),
    });
  }, [dayWidth, isAssistant]);

  async function handleBlockDates() {
    if (!freeZoneModal || blocking) return;
    setBlocking(true);
    try {
      await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Dates bloquées",
          location: profileLocation,
          specialties: [],
          startDate: new Date(freeZoneModal.suggestedStart).toISOString(),
          endDate:   new Date(freeZoneModal.suggestedEnd).toISOString(),
          missionType: "REMPLACEMENT",
          briqueStatus: "INDISPONIBLE",
          isActive: false,
        }),
      });
      setFreeZoneModal(null);
      router.refresh();
    } finally {
      setBlocking(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Modale zone libre */}
      {freeZoneModal && (
        <FreeZoneChoiceModal
          modal={freeZoneModal}
          onOpenDispo={() => {
            const { suggestedStart } = freeZoneModal;
            setFreeZoneModal(null);
            // Pas d'endDate présupposé (section 88) — la fin sera saisie sur le formulaire Du/Au
            router.push(`/disponibilites/create?startDate=${encodeURIComponent(suggestedStart)}`);
          }}
          onBlockDates={handleBlockDates}
          onClose={() => setFreeZoneModal(null)}
        />
      )}

      {/* Édition d'une disponibilité au clic sur la brique (section 64) */}
      {editSlot && (
        <SlotEditModal
          slot={editSlot}
          onClose={() => setEditSlot(null)}
          onSaved={() => { setEditSlot(null); router.refresh(); }}
        />
      )}

      {/* Bandeau d'alerte contextuel (section 47) — période ouverte sans réponse */}
      {openAlert && (
        <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2 text-xs font-semibold ${
          alertIsRed ? "bg-red-50 text-red-700 border-b border-red-200" : "bg-orange-50 text-orange-800 border-b border-orange-200"
        }`}>
          <span className="truncate">
            {alertIsRed ? "⚠" : "📅"}{" "}
            {alertIsRed
              ? (openAlert.days <= 0
                  ? `Disponibilité "${openAlert.slot.title}" sans réservation, commence aujourd'hui`
                  : `Disponibilité "${openAlert.slot.title}" sans réservation dans ${openAlert.days} jour${openAlert.days > 1 ? "s" : ""}`)
              : `Disponibilité "${openAlert.slot.title}" toujours sans réponse dans ${Math.max(1, Math.round(openAlert.days / 7))} semaine${Math.round(openAlert.days / 7) > 1 ? "s" : ""}`}
          </span>
          <Link
            href="/annonces"
            className={`ml-auto shrink-0 px-3 py-1 rounded-lg font-bold text-white transition ${
              alertIsRed ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            Voir les annonces
          </Link>
        </div>
      )}

      {/* ── En-tête ── */}
      <div className="bg-white border-b border-gray-100 px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="w-full sm:w-auto sm:flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-gray-900">Mes disponibilités</h1>
          <p className="text-xs text-gray-400 truncate">
            {profileName} · {isAssistant ? "Poste long terme (min. 3 mois)" : "Remplaçant"}
          </p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {(["month", "quarter", "year", "triennial"] as Zoom[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`md3-ripple px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                zoom === z ? "bg-white text-kine-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
        </div>

        <Link
          href="/disponibilites/create"
          className="px-3 py-2 bg-kine-600 text-white rounded-xl text-xs font-bold hover:bg-kine-700 transition"
        >
          + Ajouter
        </Link>
      </div>

      {/* ── Timeline ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Vue VERTICALE — mobile portrait (< 640px) : carte unique, barre compacte, pas de scroll horizontal */}
          {isMobile && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <p className="text-[11px] text-gray-400 text-center">
                Vue 6 mois · {fmtShort(mWin.start)} → {fmtShort(mWin.end)}
              </p>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <p className="text-sm font-semibold text-gray-800 truncate mb-2">
                  {profileName ?? (isAssistant ? "Assistant" : "Remplaçant")}
                </p>
                <div className="relative h-9 rounded-lg bg-[var(--sable-chaud)] overflow-hidden">
                  {/* Zone libre à partir d'aujourd'hui */}
                  <button
                    onClick={() => {
                      const s = new Date();
                      const e = new Date(s); e.setDate(e.getDate() + (isAssistant ? 90 : 30));
                      setFreeZoneModal({ suggestedStart: s.toISOString().slice(0, 10), suggestedEnd: e.toISOString().slice(0, 10) });
                    }}
                    title="Ouvrir cette période à la réservation"
                    className="md3-ripple absolute top-1 bottom-1 rounded-[5px] bg-kine-50 border border-dashed border-kine-200"
                    style={{ left: `${mpct(new Date())}%`, right: 0 }}
                  />
                  {/* Briques disponibilités */}
                  {missions.map(m => {
                    const start = toDate(m.startDate), end = toDate(m.endDate);
                    if (!start || !end) return null;
                    const w = mpct(end) - mpct(start);
                    if (w <= 0) return null;
                    const st = SLOT_STYLES[m.briqueStatus] ?? SLOT_STYLES["RECHERCHE"];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setEditSlot(m)}
                        title={`${m.title} · ${st.label} — modifier`}
                        className={`absolute top-1 bottom-1 rounded-[5px] flex items-center px-1 overflow-hidden ${st.bg} ${st.text}`}
                        style={{ left: `${mpct(start)}%`, width: `${Math.max(w, 2)}%` }}
                      >
                        <span className="text-[9px] font-medium truncate leading-none">{m.title}</span>
                      </button>
                    );
                  })}
                  {/* Ligne "aujourd'hui" */}
                  <div className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-10 pointer-events-none" style={{ left: `${mpct(new Date())}%` }} />
                </div>
                {missions.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">Touchez la zone claire pour ajouter une disponibilité</p>
                )}
              </div>
            </div>
          )}

          {/* Vue HORIZONTALE — desktop / paysage (>= 640px) */}
          {!isMobile && (
          <>
          {/* En-tête mois */}
          <div className="flex flex-shrink-0 border-b border-gray-200 bg-white">
            <div style={{ width: labelWidth, flexShrink: 0 }} className="border-r border-gray-100 bg-gray-50" />
            <div ref={monthHeaderRef} className="overflow-hidden flex-1">
              <div className="relative h-7" style={{ width: totalWidth }}>
                {mLabels.map((m, i) => {
                  // Section 89 — n'affiche qu'un label tous les N mois (+ débuts d'année)
                  if (m.index % monthSkip !== 0 && !m.isYearStart) return null;
                  return (
                    <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: m.offset }}>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lagon-profond)]/80 pl-1 whitespace-nowrap">{m.label}</span>
                      <div className="absolute top-0 bottom-0 left-0 w-px bg-gray-200" />
                    </div>
                  );
                })}
                {/* Signature sections 46-47 — flèche de progression "aujourd'hui" */}
                <div
                  className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-20 cursor-help"
                  style={{ left: todayOff }}
                  title={`Aujourd'hui — ${todayFull}`}
                >
                  <span className="absolute top-0.5 left-1.5 text-[9px] font-bold tracking-wide text-[var(--lagon-profond)] whitespace-nowrap">auj.</span>
                  <div className="planning-today-marker absolute top-1/2 -translate-y-1/2 left-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-[var(--lagon-profond)]" />
                </div>
              </div>
            </div>
          </div>

          {/* Ligne principale — pr-4 : marge à droite (régression padding, section 64) */}
          <div
            ref={rowsScrollRef}
            className="flex-1 overflow-y-auto overflow-x-auto pr-4"
            onScroll={(e) => {
              if (monthHeaderRef.current) monthHeaderRef.current.scrollLeft = Math.max(0, e.currentTarget.scrollLeft - labelWidth);
            }}
          >
            <div style={{ minWidth: totalWidth + labelWidth }}>
              <div className="flex border-b border-gray-100" style={{ height: TRACK_HEIGHT }}>
                {/* Label — sticky (section 90) : reste visible sur tous les zooms
                    malgré le défilement horizontal automatique vers "aujourd'hui". */}
                <div
                  className="shrink-0 sticky left-0 z-20 flex items-center px-3 border-r border-gray-100 bg-gray-50"
                  style={{ width: labelWidth }}
                >
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    {profileName ?? (isAssistant ? "Assistant" : "Remplaçant")}
                  </span>
                </div>

                {/* Piste */}
                <div className="relative flex-1 overflow-hidden bg-[var(--sable-chaud)]">
                  <div className="relative" style={{ width: totalWidth, height: "100%" }}>
                    {/* Zone libre cliquable */}
                    <div
                      className="absolute top-1.5 bottom-1.5 bg-kine-50 border border-dashed border-kine-200 rounded-xl cursor-pointer hover:bg-kine-100 transition"
                      style={{ left: Math.max(todayOff, 0), right: 0 }}
                      onClick={handleFreeZoneClick}
                      title="Cliquez pour ouvrir cette période"
                    />

                    {/* Briques */}
                    {missions.map(m => (
                      <SlotBrick key={m.id} slot={m} dayWidth={dayWidth} onEdit={setEditSlot} />
                    ))}

                    {/* Ligne aujourd'hui — lagon profond, pulsation douce (sections 46-47) */}
                    <div
                      className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-10 pointer-events-none"
                      style={{ left: todayOff }}
                    />
                  </div>
                </div>
              </div>

              {/* Message si aucune période */}
              {missions.length === 0 && (
                <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                  <div className="text-center">
                    <p className="mb-2">Aucune période renseignée</p>
                    <p className="text-xs text-gray-300">Cliquez sur la piste bleue pour ajouter une disponibilité</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          </>
          )}

          {/* Légende */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-2 flex items-center gap-4 overflow-x-auto">
            {[
              { color: "bg-[var(--ambre)]",      label: "Disponible" },
              { color: "bg-[var(--vert-palme)]", label: "Confirmé" },
              { color: "bg-[var(--orange-vif)]", label: "En attente" },
              { color: "timeline-hatch",         label: "Indisponible" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-3 h-3 rounded-[3px] ${l.color}`} />
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
