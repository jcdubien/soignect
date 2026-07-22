"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ShareActions from "@/components/share/ShareActions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MissionSlot {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  briqueStatus: string;
  missionType: string;
  matchId?: string | null;        // match rattaché (section 149) — présent si période pourvue
  matchOtherName?: string | null; // nom de l'autre partie (cabinet) pour le menu adaptatif
  pendingCount?: number;          // cabinets qui ont liké cette dispo, sans réciprocité (section 162)
  confirmedCount?: number;        // mises en relation confirmées sur cette dispo
}

interface LinkedPost {
  id: string;
  label: string;
  cabinetName: string | null;
  isCollaboration?: boolean; // wording « collaborateur » vs « assistant » (section 162)
}

interface Props {
  profileName: string | null;
  profileType: "REMPLACANT" | "ASSISTANT";
  profileLocation: string;
  missions: MissionSlot[];
  // Poste cabinet auquel cet assistant est rattaché (section 153, point 5) — null sinon.
  linkedPost?: LinkedPost | null;
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

// Vue verticale mobile : la fenêtre dépend du zoom (section 91) — sinon le zoom
// n'a aucun effet visible sur mobile. ~10% de passé, le reste pour le futur (section 87).
function mobileWindow(spanDays: number): { start: Date; end: Date } {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.round(spanDays * 0.1));
  const end = new Date(start); end.setDate(end.getDate() + spanDays);
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
  blocking,
  onOpenDispo,
  onBlockDates,
  onClose,
}: {
  modal: FreeZoneModal;
  blocking: boolean;
  onOpenDispo: (start: string, end: string) => void;
  onBlockDates: (start: string, end: string) => void;
  onClose: () => void;
}) {
  // Plage éditable (section 178) : les deux actions opèrent sur la MÊME plage visible Du/Au,
  // pré-remplie depuis la position du clic. Fini la fenêtre de blocage cachée de 30 jours et
  // l'asymétrie entre « Oui » (formulaire) et « Non » (POST direct opaque).
  const [start, setStart] = useState(modal.suggestedStart);
  const [end, setEnd] = useState(modal.suggestedEnd);
  const valid = !!start && !!end && end >= start;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-kine-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-xl">📅</span>
          </div>
          <h3 className="font-bold text-gray-900 text-base leading-tight">
            Choisir cette période
          </h3>
        </div>

        {/* Plage Du / Au — visible et modifiable avant toute action */}
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Du</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Au</label>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            />
          </div>
        </div>
        {!valid && (
          <p className="text-xs text-amber-600 mb-3">La date de fin doit être postérieure à la date de début.</p>
        )}

        <div className="flex flex-col gap-2.5 mt-4">
          <button
            onClick={() => onOpenDispo(start, end)}
            disabled={!valid}
            className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition disabled:opacity-40"
          >
            Je suis disponible sur cette plage →
          </button>
          <button
            onClick={() => onBlockDates(start, end)}
            disabled={!valid || blocking}
            className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40"
          >
            {blocking ? "Blocage…" : "Bloquer cette plage (indisponible)"}
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
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!start || !end || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/missions/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(title.trim().length >= 3 ? { title: title.trim() } : {}),
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d?.error === "string" ? d.error : "L'enregistrement a échoué. Réessayez.");
      setBusy(false);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    // On NE ferme le modal que si la suppression a réellement réussi (sinon l'erreur était
    // avalée et la période restait — le serveur nettoie désormais swipes/matchs liés).
    const res = await fetch(`/api/missions/${slot.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d?.error === "string" ? d.error : "La suppression a échoué. Réessayez.");
      setBusy(false);
      return;
    }
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
          {/* Candidatures reçues sur cette disponibilité (section 162) — symétrie avec le
              compteur cabinet : cabinets en attente (like reçu) / mises en relation confirmées. */}
          <div className="flex items-center gap-2">
            <Link
              href={`/annonces?disponibiliteId=${encodeURIComponent(slot.id)}`}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
              title="Cabinets intéressés en attente de votre réponse"
            >
              ⏳ {slot.pendingCount ?? 0} en attente
            </Link>
            <Link
              href={`/annonces?disponibiliteId=${encodeURIComponent(slot.id)}`}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-kine-600 text-white hover:bg-kine-700 transition"
              title="Mises en relation confirmées"
            >
              🤝 {slot.confirmedCount ?? 0} confirmée{(slot.confirmedCount ?? 0) > 1 ? "s" : ""}
            </Link>
          </div>

          {/* Partager ma disponibilité (section 162) — copier le lien + natif Android/iPhone + FB.
              Le lien mène à la page publique, qui demande auth/inscription au visiteur. */}
          <div className="pt-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Partager ma disponibilité</p>
            <ShareActions path={`/annonce/${slot.id}`} title={slot.title} />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={remove} disabled={busy}
              className="px-3 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition disabled:opacity-40">
              {busy ? "…" : "Supprimer"}
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

// Menu adaptatif d'une période POURVUE (match confirmé, section 149) — au lieu du modal
// d'édition : accès direct à la fiche du match précis + annulation sécurisée.
function SlotMatchModal({ slot, onClose, onChanged }: {
  slot: MissionSlot; onClose: () => void; onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelMatch() {
    if (!slot.matchId || busy) return;
    setBusy(true);
    setError(null);
    try {
      // force=true : lève le garde « contrat confirmé » côté serveur pour CETTE annulation
      // explicitement confirmée par l'utilisateur (notif de l'autre partie + resync planning).
      const res = await fetch(`/api/match/${slot.matchId}?force=true`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d?.error === "string" ? d.error : "L'annulation a échoué. Réessayez.");
        setBusy(false);
        return;
      }
      onChanged();
    } catch {
      setError("Erreur réseau. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
        {!confirming ? (
          <>
            <h3 className="font-bold text-gray-900 text-base">Mise en relation confirmée</h3>
            <p className="text-sm text-gray-500 mt-1">
              {slot.matchOtherName ? `Avec ${slot.matchOtherName}` : "Période pourvue"} · {slot.title}
            </p>
            <div className="flex flex-col gap-2 mt-5">
              <Link
                href={`/match/${slot.matchId}`}
                className="w-full py-2.5 bg-kine-600 text-white rounded-xl text-sm font-bold text-center hover:bg-kine-700 transition"
              >
                Voir la fiche du match →
              </Link>
              <button
                onClick={() => setConfirming(true)}
                className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
              >
                Supprimer ce match
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                Fermer
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-bold text-gray-900 text-base">Annuler cette mise en relation confirmée ?</h3>
            <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 leading-relaxed">
              Êtes-vous sûr de vouloir annuler cette mise en relation confirmée ? Le contrat signé
              rattaché à cette période sera annulé et la conversation supprimée ; la période
              redeviendra disponible. <strong>{slot.matchOtherName ?? "L'autre partie"} sera
              notifié·e de cette annulation.</strong> Cette action est irréversible.
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40"
              >
                Retour
              </button>
              <button
                onClick={cancelMatch}
                disabled={busy}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:opacity-40"
              >
                {busy ? "Annulation…" : "Oui, annuler"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── DisponibilitesBoard principal ─────────────────────────────────────────────

export default function DisponibilitesBoard({ profileName, profileType, profileLocation, missions, linkedPost }: Props) {
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
  const mWin = mobileWindow(ZOOM_DAYS[zoom]);
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
    // La zone libre commence à AUJOURD'HUI (left = todayOff), pas à RANGE_START : on part
    // donc de l'offset d'aujourd'hui, sinon la date suggérée est ~1 mois trop tôt (parfois
    // dans le passé), section 149. Bord gauche de la zone = aujourd'hui.
    const dayIndex = dayOffset(new Date()) + Math.max(0, Math.floor(relX / dayWidth));
    const startDate = new Date(RANGE_START.getTime() + dayIndex * 86400000);
    const endDate   = new Date(startDate);
    endDate.setDate(endDate.getDate() + (isAssistant ? 90 : 30));

    setFreeZoneModal({
      suggestedStart: startDate.toISOString().slice(0, 10),
      suggestedEnd:   endDate.toISOString().slice(0, 10),
    });
  }, [dayWidth, isAssistant]);

  // Bloque EXACTEMENT la plage choisie dans la modale (section 178) — plus de fenêtre cachée
  // de 30 jours : start/end viennent des champs Du/Au visibles et éditables.
  async function handleBlockDates(start: string, end: string) {
    if (blocking) return;
    setBlocking(true);
    try {
      await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Dates bloquées",
          location: profileLocation,
          specialties: [],
          startDate: new Date(start).toISOString(),
          endDate:   new Date(end).toISOString(),
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
          blocking={blocking}
          onOpenDispo={(start, end) => {
            setFreeZoneModal(null);
            // Préremplit Du ET Au sur le formulaire complet (section 178) — l'utilisateur
            // arrive sur une vraie plage éditable, plus « on confirme juste un départ ».
            router.push(
              `/disponibilites/create?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
            );
          }}
          onBlockDates={handleBlockDates}
          onClose={() => setFreeZoneModal(null)}
        />
      )}

      {/* Édition d'une disponibilité au clic sur la brique (section 64) */}
      {editSlot && (
        editSlot.briqueStatus === "CONFIRME" && editSlot.matchId ? (
          // Cas 2 — période pourvue (match confirmé) : menu dédié (fiche match + annulation)
          <SlotMatchModal
            slot={editSlot}
            onClose={() => setEditSlot(null)}
            onChanged={() => { setEditSlot(null); router.refresh(); }}
          />
        ) : (
          // Cas 1 — période sans match : modal d'édition inchangé
          <SlotEditModal
            slot={editSlot}
            onClose={() => setEditSlot(null)}
            onSaved={() => { setEditSlot(null); router.refresh(); }}
          />
        )
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

      {/* Bannière « poste rattaché » (section 153, point 5) — l'assistant placé dans un
          cabinet voit son poste + peut recruter un remplaçant pour couvrir son absence. */}
      {linkedPost && (
        <div className="bg-violet-50 border-b border-violet-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-violet-800">
            👩‍⚕️ Vous êtes actuellement {linkedPost.isCollaboration ? "collaborateur·rice" : "assistant·e"}{linkedPost.cabinetName ? <> chez <strong>{linkedPost.cabinetName}</strong></> : ""} (poste « {linkedPost.label} »).
          </p>
          <Link
            href={`/missions/create?cabinetPostId=${encodeURIComponent(linkedPost.id)}&needType=remplacement`}
            className="shrink-0 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 transition"
          >
            Faire remplacer mon absence →
          </Link>
        </div>
      )}

      {/* ── En-tête ── */}
      <div className="bg-white border-b border-gray-100 px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Titre en largeur naturelle (plus de sm:flex-1) : le groupe de zoom se place juste
            à sa droite, sans espace vide forcé depuis le retrait du bouton « + Ajouter » (section 148). */}
        <div className="w-full sm:w-auto min-w-0">
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
              className={`md3-ripple px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                zoom === z ? "bg-white text-kine-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
        </div>

        {/* Bouton « + Ajouter » supprimé (section 148) — ajout d'une disponibilité
            uniquement via clic sur la timeline (zone claire → créer). */}
      </div>

      {/* ── Timeline ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Vue VERTICALE — mobile portrait (< 640px) : carte unique, barre compacte, pas de scroll horizontal */}
          {isMobile && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <p className="text-[11px] text-gray-400 text-center">
                Vue {ZOOM_LABELS[zoom]} · {fmtShort(mWin.start)} → {fmtShort(mWin.end)}
              </p>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <p className="text-sm font-semibold text-gray-800 truncate mb-2">
                  {profileName ?? (isAssistant ? "Assistant" : "Remplaçant")}
                </p>
                {/* Piste h-14 (56px) au lieu de h-9 : cible tactile confortable ≥44px pour
                    le tap « ajouter une disponibilité » (section 149). */}
                <div className="relative h-14 rounded-lg bg-[var(--sable-chaud)] overflow-hidden">
                  {/* Zone libre à partir d'aujourd'hui */}
                  {/* Zone libre cliquable — PAS de classe md3-ripple ici : `.md3-ripple`
                      (position:relative, défini après @tailwind utilities) écrasait le
                      `absolute` → le bouton s'effondrait à ~0 largeur et devenait
                      quasi-intappable (échec ~9/10, section 149). */}
                  <button
                    onClick={(ev) => {
                      // Ancrage au tap (section 178) : le bouton s'étend d'aujourd'hui à la fin de
                      // la fenêtre ; la position horizontale du tap donne la date de début (avant :
                      // toujours « aujourd'hui », quel que soit l'endroit tapé).
                      const rect = ev.currentTarget.getBoundingClientRect();
                      const frac = rect.width > 0 ? Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)) : 0;
                      const todayMs = Date.now();
                      const s = new Date(todayMs + frac * (mWin.end.getTime() - todayMs));
                      s.setHours(0, 0, 0, 0);
                      const e = new Date(s); e.setDate(e.getDate() + (isAssistant ? 90 : 30));
                      setFreeZoneModal({ suggestedStart: s.toISOString().slice(0, 10), suggestedEnd: e.toISOString().slice(0, 10) });
                    }}
                    title="Ouvrir cette période à la réservation"
                    className="absolute top-1 bottom-1 rounded-[5px] bg-kine-50 border border-dashed border-kine-200 active:bg-kine-100 transition"
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
                    {/* Zone libre cliquable — pleine hauteur de la ligne (top-0 bottom-0) pour
                        une cible tactile fiable (avant : bande fine top-1.5 bottom-1.5 que les
                        clics manquaient ~9/10, section 149). */}
                    <div
                      className="absolute top-0 bottom-0 bg-kine-50 border border-dashed border-kine-200 rounded-xl cursor-pointer hover:bg-kine-100 transition"
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
