"use client";

import { useState, useCallback } from "react";
import SwipeStack from "@/components/swipe/SwipeStack";
import MatchTray from "@/components/swipe/MatchTray";
import RecentMissionsTray, { RecentMission } from "@/components/swipe/RecentMissionsTray";
import MissionDetailSheet, { DetailMission, MissionRelation } from "@/components/swipe/MissionDetailSheet";
import { TitulaireMission } from "@/components/swipe/MissionSelector";

interface Props {
  profileType: string;
  profileId: string;
  isPremium?: boolean;
  titulaireMissions: TitulaireMission[];
  initialMissionId?: string;
  disponibiliteId?: string;
}

export default function AnnoncesClient({ profileType, profileId, isPremium, titulaireMissions, initialMissionId, disponibiliteId }: Props) {
  const [trayKey, setTrayKey] = useState(0);
  const [detail, setDetail] = useState<{ mission: DetailMission; relation: MissionRelation } | null>(null);

  // Clic sur une annonce récente → même fiche détaillée (bottom sheet) que l'icône "i",
  // enrichie du statut réel de l'utilisateur (swipe / mise en relation).
  const handleSelectRecent = useCallback(async (rm: RecentMission) => {
    try {
      const r = await fetch(`/api/missions/${rm.id}/card`);
      if (!r.ok) return;
      const d = await r.json();
      setDetail({ mission: d.mission, relation: d.relation });
    } catch { /* silencieux */ }
  }, []);

  // Swipe depuis le bottom sheet (annonce jamais traitée) — enregistrement normal.
  const handleSheetSwipe = useCallback(async (direction: "LEFT" | "RIGHT") => {
    const current = detail;
    if (!current) return;
    try {
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swipedMissionId: current.mission.id, direction }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setDetail((cur) =>
        cur
          ? { ...cur, relation: { swipeDirection: direction, matchId: data?.match?.id ?? cur.relation.matchId ?? null } }
          : cur
      );
      if (direction === "RIGHT") setTrayKey((k) => k + 1); // rafraîchit le tray "Vos mises en relation"
    } catch { /* silencieux */ }
  }, [detail]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <RecentMissionsTray onSelectMission={handleSelectRecent} />

      <div className="flex-1 flex flex-col min-h-0">
        <SwipeStack
          onSwipeRight={() => setTrayKey(k => k + 1)}
          profileType={profileType}
          titulaireMissions={titulaireMissions}
          initialMissionId={initialMissionId}
        />
      </div>

      <MatchTray refreshKey={trayKey} titulaireMissions={titulaireMissions} myProfileType={profileType} myProfileId={profileId} isPremium={isPremium} disponibiliteId={disponibiliteId} />

      {/* Fiche détaillée hors carrousel — même composant que l'icône "i", avec statut + actions */}
      {detail && (
        <MissionDetailSheet
          mission={detail.mission}
          relation={detail.relation}
          onSwipe={handleSheetSwipe}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
