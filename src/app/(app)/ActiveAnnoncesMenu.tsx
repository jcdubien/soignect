"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface ActiveMission {
  id: string;
  title: string;
  location: string;
  missionType: string;
}

const TYPE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat",
  COLLABORATION: "Collaboration",
};

// Compteur « N annonces actives » cliquable (section 21/102). Au clic : liste des annonces
// actives du cabinet ; chaque item ouvre l'édition (flux « Modifier l'annonce » existant :
// /missions/create?editId=<id>). Le compteur affiché = missions.length (= _count.missions).
// Le menu est en position fixed pour ne pas être rogné par l'overflow-hidden du header.
export default function ActiveAnnoncesMenu({
  location,
  missions,
}: {
  location: string;
  missions: ActiveMission[];
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const count = missions.length;

  const PANEL_WIDTH = 288; // w-72

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8));
      setCoords({ top: r.bottom + 6, left });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    function onDown(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        const panel = document.getElementById("active-annonces-panel");
        if (!panel || !panel.contains(e.target as Node)) setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const label = `${count} annonce${count !== 1 ? "s" : ""} active${count !== 1 ? "s" : ""}`;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-gray-400 truncate shrink-0 max-w-[120px]">{location}</span>
      <span className="text-gray-300 shrink-0">·</span>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={count === 0}
        aria-expanded={open}
        aria-haspopup="menu"
        className="shrink-0 font-medium text-kine-600 underline decoration-dotted underline-offset-2 hover:text-kine-800 disabled:text-gray-400 disabled:no-underline disabled:cursor-default"
      >
        {label}
      </button>

      {open && count > 0 && coords && (
        <div
          id="active-annonces-panel"
          role="menu"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: PANEL_WIDTH }}
          className="max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[60]"
        >
          <p className="px-4 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
            Annonces actives
          </p>
          {missions.map((m) => (
            <Link
              key={m.id}
              href={`/missions/create?editId=${m.id}`}
              onClick={() => setOpen(false)}
              className="flex flex-col px-4 py-2 hover:bg-gray-50 transition"
              role="menuitem"
            >
              <span className="text-sm font-semibold text-gray-800 truncate">{m.title}</span>
              <span className="text-xs text-gray-400 truncate">
                {TYPE_LABEL[m.missionType] ?? m.missionType} · 📍 {m.location}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
