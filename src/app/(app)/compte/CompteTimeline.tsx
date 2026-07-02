"use client";

import Link from "next/link";
import { useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MatchedMission {
  matchId: string;
  missionTitle: string;
  cabinetName: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  location: string | null;
}

interface Props {
  matches: MatchedMission[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

function fmtShort(d: Date | string | null): string {
  if (!d) return "?";
  return new Date(d as string).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtYear(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d as string).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

// Range : min(startDate) -1mois → max(endDate) +1mois (ou ±6mois autour d'aujourd'hui si pas de data)
function computeRange(matches: MatchedMission[]): { rangeStart: Date; totalDays: number } {
  const now = new Date();
  let minMs = now.getTime() - 90 * 86400000;
  let maxMs = now.getTime() + 180 * 86400000;

  for (const m of matches) {
    const s = toDate(m.startDate);
    const e = toDate(m.endDate);
    if (s) minMs = Math.min(minMs, s.getTime() - 30 * 86400000);
    if (e) maxMs = Math.max(maxMs, e.getTime() + 30 * 86400000);
  }

  const rangeStart = new Date(minMs);
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);
  const totalDays = Math.ceil((maxMs - rangeStart.getTime()) / 86400000);

  return { rangeStart, totalDays };
}

function dayOffset(d: Date, rangeStart: Date): number {
  return Math.floor((d.getTime() - rangeStart.getTime()) / 86400000);
}

function monthLabels(rangeStart: Date, totalDays: number, dayWidth: number) {
  const labels: { label: string; offset: number }[] = [];
  const rangeEnd = new Date(rangeStart.getTime() + totalDays * 86400000);
  const cur = new Date(rangeStart);
  cur.setDate(1);
  while (cur <= rangeEnd) {
    labels.push({
      label: cur.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      offset: dayOffset(cur, rangeStart) * dayWidth,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return labels;
}

// Mission status colors
function brickColor(m: MatchedMission): string {
  const now = new Date();
  const start = toDate(m.startDate);
  const end   = toDate(m.endDate);
  if (!start || !end) return "bg-gray-200";
  if (end < now)   return "bg-gray-400";        // passé
  if (start > now) return "bg-kine-500";         // futur
  return "bg-emerald-500";                       // en cours
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompteTimeline({ matches }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (matches.length === 0) {
    return (
      <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Ma timeline</h2>
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">Aucune mise en relation confirmée pour l&apos;instant.</p>
          <Link href="/annonces" className="inline-block mt-3 text-xs font-semibold text-kine-600 hover:underline">
            Voir les annonces →
          </Link>
        </div>
      </section>
    );
  }

  const DAY_WIDTH = 4; // px par jour
  const TRACK_H   = 40;
  const { rangeStart, totalDays } = computeRange(matches);
  const totalWidth = totalDays * DAY_WIDTH;
  const todayOffset = dayOffset(new Date(), rangeStart) * DAY_WIDTH;
  const mLabels = monthLabels(rangeStart, totalDays, DAY_WIDTH);

  // Trier les matchs par date de début
  const sorted = [...matches].sort((a, b) => {
    const as = toDate(a.startDate)?.getTime() ?? 0;
    const bs = toDate(b.startDate)?.getTime() ?? 0;
    return as - bs;
  });

  return (
    <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Ma timeline</h2>
      <p className="text-xs text-gray-400 mb-3">{matches.length} mission{matches.length !== 1 ? "s" : ""} confirmée{matches.length !== 1 ? "s" : ""}</p>

      {/* Légende */}
      <div className="flex items-center gap-4 mb-3">
        {[
          { color: "bg-emerald-500", label: "En cours" },
          { color: "bg-kine-500",    label: "À venir" },
          { color: "bg-gray-400",    label: "Terminé" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded ${l.color}`} />
            <span className="text-[10px] text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline scrollable */}
      <div className="overflow-x-auto rounded-xl border border-gray-100" ref={scrollRef}>
        <div style={{ minWidth: Math.max(totalWidth, 400), position: "relative" }}>
          {/* En-tête mois */}
          <div className="relative h-6 border-b border-gray-100 bg-gray-50">
            {mLabels.map((m, i) => (
              <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: m.offset }}>
                <div className="absolute top-0 bottom-0 left-0 w-px bg-gray-200" />
                <span className="text-[9px] font-semibold text-gray-400 pl-1 whitespace-nowrap">{m.label}</span>
              </div>
            ))}
            {/* Marker aujourd'hui */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: todayOffset }}>
              <span className="absolute -top-0 left-1 text-[8px] text-red-500 font-bold whitespace-nowrap">auj.</span>
            </div>
          </div>

          {/* Briques missions */}
          {sorted.map((m) => {
            const start = toDate(m.startDate);
            const end   = toDate(m.endDate);
            if (!start || !end) return null;
            const left  = Math.max(dayOffset(start, rangeStart), 0) * DAY_WIDTH;
            const right = Math.min(dayOffset(end, rangeStart), totalDays) * DAY_WIDTH;
            const width = right - left;
            if (width <= 0) return null;

            return (
              <div
                key={m.matchId}
                className="relative"
                style={{ height: TRACK_H, paddingTop: 6, paddingBottom: 6 }}
              >
                <Link href={`/match/${m.matchId}`}>
                  <div
                    className={`absolute top-1.5 bottom-1.5 rounded-lg flex items-center px-2 cursor-pointer hover:opacity-90 transition ${brickColor(m)}`}
                    style={{ left, width: Math.max(width, 32) }}
                    title={`${m.missionTitle} · ${fmtShort(m.startDate)} → ${fmtShort(m.endDate)}`}
                  >
                    <span className="text-[10px] font-semibold text-white truncate">
                      {m.cabinetName ?? m.missionTitle}
                    </span>
                  </div>
                </Link>

                {/* Ligne today */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none"
                  style={{ left: todayOffset }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste condensée en-dessous */}
      <div className="mt-3 space-y-1.5">
        {sorted.map(m => (
          <Link
            key={m.matchId}
            href={`/match/${m.matchId}`}
            className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 hover:bg-gray-50 transition"
          >
            <div>
              <p className="text-xs font-semibold text-gray-800">{m.cabinetName ?? m.missionTitle}</p>
              {m.location && <p className="text-[10px] text-gray-400">{m.location}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500">{fmtShort(m.startDate)} → {fmtShort(m.endDate)}</p>
              <p className="text-[10px] text-gray-300">{fmtYear(m.startDate)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
