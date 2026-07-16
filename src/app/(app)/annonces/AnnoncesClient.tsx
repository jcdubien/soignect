"use client";

import { useState, useCallback } from "react";
import SwipeStack from "@/components/swipe/SwipeStack";
import MatchTray from "@/components/swipe/MatchTray";
import RecentMissionsTray, { RecentMission, removeRecentMission } from "@/components/swipe/RecentMissionsTray";
import LaunchOfferBanner from "@/components/ui/LaunchOfferBanner";
import MissionDetailSheet, { DetailMission, MissionRelation } from "@/components/swipe/MissionDetailSheet";
import { TitulaireMission } from "@/components/swipe/MissionSelector";

interface Props {
  profileType: string;
  profileId: string;
  isPremium?: boolean;
  freeAccessMode?: boolean;
  titulaireMissions: TitulaireMission[];
  initialMissionId?: string;
  disponibiliteId?: string;
}

export default function AnnoncesClient({ profileType, profileId, isPremium, freeAccessMode, titulaireMissions, initialMissionId, disponibiliteId }: Props) {
  const [trayKey, setTrayKey] = useState(0);
  const [detail, setDetail] = useState<{ mission: DetailMission; relation: MissionRelation } | null>(null);
  // Vrai quand SwipeStack n'affiche aucune carte (vide/chargement/erreur). Sur mobile on
  // n'étire alors plus la zone de swipe : les trays remontent juste sous le message
  // (fini le grand vide). Sur desktop (lg) la colonne garde flex-1 (panneau latéral).
  const [swipeEmpty, setSwipeEmpty] = useState(true);

  // Clic sur une annonce récente → même fiche détaillée (bottom sheet) que l'icône "i",
  // enrichie du statut réel de l'utilisateur (swipe / mise en relation).
  const handleSelectRecent = useCallback(async (rm: RecentMission) => {
    try {
      const r = await fetch(`/api/missions/${rm.id}/card`);
      if (!r.ok) {
        // Annonce supprimée/introuvable → on la retire de l'historique pour ne plus la proposer.
        if (r.status === 404) removeRecentMission(rm.id, profileId);
        return;
      }
      const d = await r.json();
      setDetail({ mission: d.mission, relation: d.relation });
    } catch { /* silencieux */ }
  }, [profileId]);

  // Swipe depuis le bottom sheet (annonce jamais traitée) — enregistrement normal.
  const handleSheetSwipe = useCallback(async (direction: "LEFT" | "RIGHT") => {
    const current = detail;
    if (!current) return;
    // On NE capture PAS l'erreur ici : elle remonte au bottom sheet (MissionDetailSheet.handleSwipe)
    // qui l'affiche à l'utilisateur (fini l'échec silencieux).
    const res = await fetch("/api/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swipedMissionId: current.mission.id, direction }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(typeof d?.error === "string" ? d.error : "Le swipe n'a pas pu être enregistré. Réessayez.");
    }
    const data = await res.json();
    setDetail((cur) =>
      cur
        ? { ...cur, relation: { ...cur.relation, swipeDirection: direction, matchId: data?.match?.id ?? cur.relation.matchId ?? null } }
        : cur
    );
    if (direction === "RIGHT") setTrayKey((k) => k + 1); // rafraîchit le tray "Vos mises en relation"
  }, [detail]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <LaunchOfferBanner profileType={profileType} profileId={profileId} freeAccessMode={freeAccessMode} />
      <RecentMissionsTray onSelectMission={handleSelectRecent} profileId={profileId} />

      {/* Mobile : colonne (swipe + tray en bande bas). Desktop : deux colonnes (swipe centré + panneau latéral droit). */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className={`${swipeEmpty ? "flex-none lg:flex-1" : "flex-1"} flex flex-col min-h-0`}>
          <SwipeStack
            onSwipeRight={() => setTrayKey(k => k + 1)}
            onEmptyChange={setSwipeEmpty}
            profileType={profileType}
            profileId={profileId}
            titulaireMissions={titulaireMissions}
            initialMissionId={initialMissionId}
          />
        </div>

        <MatchTray refreshKey={trayKey} titulaireMissions={titulaireMissions} myProfileType={profileType} myProfileId={profileId} isPremium={isPremium} disponibiliteId={disponibiliteId} />
      </div>

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
