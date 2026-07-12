"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Heart } from "lucide-react";
import BottomSheet from "@/components/ui/md3/BottomSheet";

// Type souple, compatible avec MissionWithProfile (carrousel) ET la réponse /card.
export interface DetailMission {
  id: string;
  title: string;
  location: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  minMonths?: number | null;
  bioTinder?: string | null;
  profile: {
    name: string | null;
    type: string;
    photoUrl: string | null;
    secondaryPhotoUrl1?: string | null;
    secondaryPhotoUrl2?: string | null;
    region?: string | null;
    bioTinder?: string | null;
  };
}

export interface MissionRelation {
  swipeDirection: "LEFT" | "RIGHT" | null;
  matchId: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  REMPLACANT: "Remplaçant",
  ASSISTANT: "Assistant",
  TITULAIRE: "Cabinet",
};

function fmt(d?: Date | string | null): string | null {
  if (!d) return null;
  return new Date(d as string).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function MissionDetailSheet({
  mission,
  onClose,
  relation,
  onSwipe,
}: {
  mission: DetailMission;
  onClose: () => void;
  // Mode "hors carrousel" : si fourni, on affiche le statut + les actions.
  // undefined = ouvert depuis le carrousel → comportement inchangé (pas d'actions).
  relation?: MissionRelation | null;
  onSwipe?: (direction: "LEFT" | "RIGHT") => Promise<void> | void;
}) {
  const p = mission.profile;
  const photos = [p.photoUrl, p.secondaryPhotoUrl1, p.secondaryPhotoUrl2].filter(Boolean) as string[];
  const bioText = mission.bioTinder ?? p.bioTinder ?? null;
  const dateRange =
    mission.startDate && mission.endDate ? `${fmt(mission.startDate)} → ${fmt(mission.endDate)}`
    : mission.startDate ? `Dès le ${fmt(mission.startDate)}`
    : mission.minMonths ? `${mission.minMonths} mois min.` : null;
  const typeLabel = TYPE_LABEL[p.type] ?? p.type;

  const [summary, setSummary] = useState<{ extract: string; url?: string | null } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const region = p.region ?? "GUADELOUPE";
    fetch(`/api/commune-summary?commune=${encodeURIComponent(mission.location)}&region=${encodeURIComponent(region)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setSummary(d?.summary ?? null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSummary(false); });
    return () => { cancelled = true; };
  }, [mission.location, p.region]);

  async function handleSwipe(direction: "LEFT" | "RIGHT") {
    if (swiping || !onSwipe) return;
    setSwiping(true);
    try {
      await onSwipe(direction);
    } finally {
      setSwiping(false);
    }
  }

  // Bloc de statut / actions (uniquement en mode hors carrousel)
  function renderActions() {
    if (relation === undefined) return null; // mode carrousel : rien
    if (relation?.matchId) {
      return (
        <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-emerald-700 font-semibold text-sm">Mise en relation confirmée</p>
            <p className="text-emerald-500 text-xs mt-0.5">Poursuivez la conversation.</p>
          </div>
          <Link
            href={`/matches?matchId=${relation.matchId}`}
            className="shrink-0 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition"
          >
            Ouvrir →
          </Link>
        </div>
      );
    }
    if (relation?.swipeDirection === "RIGHT") {
      return (
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-center">
          <p className="text-amber-700 font-semibold text-sm">En attente de réponse</p>
          <p className="text-amber-500 text-xs mt-0.5">Vous avez manifesté votre intérêt — l&apos;autre partie ne s&apos;est pas encore prononcée.</p>
        </div>
      );
    }
    if (relation?.swipeDirection === "LEFT") {
      return (
        <div className="mt-4 rounded-2xl bg-gray-100 border border-gray-200 p-3.5 text-center">
          <p className="text-gray-600 font-semibold text-sm">Annonce passée</p>
          <p className="text-gray-400 text-xs mt-0.5">Vous avez passé cette annonce.</p>
        </div>
      );
    }
    // Jamais swipée → décider directement ici
    return (
      <div className="mt-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 text-center">Votre décision</p>
        <div className="flex items-center justify-center gap-10">
          <button
            type="button"
            onClick={() => handleSwipe("LEFT")}
            disabled={swiping}
            aria-label="Passer"
            className="shrink-0 w-14 h-14 rounded-full bg-white border border-gray-200 text-gray-500 shadow-md hover:bg-red-50 hover:text-red-500 hover:border-red-200 active:scale-90 transition disabled:opacity-40 flex items-center justify-center"
          >
            <X size={26} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => handleSwipe("RIGHT")}
            disabled={swiping}
            aria-label="Intéressé"
            className="shrink-0 w-14 h-14 rounded-full bg-[#0B3D5C] text-white shadow-lg hover:bg-[#0e4d73] active:scale-90 transition disabled:opacity-40 flex items-center justify-center"
          >
            <Heart size={24} strokeWidth={2} fill="currentColor" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <BottomSheet open onClose={onClose} zClass="z-[70]">
      <div className="px-5 py-4 overflow-y-auto">
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {photos.map((src, i) => (
              <div key={i} className="relative shrink-0 w-40 h-52 rounded-2xl overflow-hidden bg-gray-100">
                <Image src={src} alt="" fill className="object-cover" sizes="160px" unoptimized />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          {p.name && <p className="text-base font-black text-gray-900 leading-tight">{p.name}</p>}
          <h3 className="text-sm font-semibold text-gray-600 mt-0.5">{mission.title}</h3>
          <p className="text-xs text-gray-400 mt-1">
            📍 {mission.location} · {typeLabel}{dateRange ? ` · ${dateRange}` : ""}
          </p>
        </div>

        {bioText && (
          <p className="mt-3 text-sm text-kine-700 italic border-l-2 border-kine-400 pl-3 bg-kine-50 rounded-r-xl py-2 pr-2">
            {bioText}
          </p>
        )}

        <div className="mt-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
            À propos de {mission.location}
          </p>
          {loadingSummary ? (
            <p className="text-xs text-gray-400">Chargement…</p>
          ) : summary ? (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">{summary.extract}</p>
              {summary.url && (
                <a href={summary.url} target="_blank" rel="noopener noreferrer" className="text-xs text-kine-600 underline mt-1 inline-block">
                  Source : Wikipédia
                </a>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">Aucune description disponible pour cette commune.</p>
          )}
        </div>

        {renderActions()}

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
        >
          Fermer
        </button>
      </div>
    </BottomSheet>
  );
}
