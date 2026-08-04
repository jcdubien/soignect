"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SwipeStack from "@/components/swipe/SwipeStack";
import MatchTray from "@/components/swipe/MatchTray";
import RecentMissionsTray, { RecentMission, removeRecentMission } from "@/components/swipe/RecentMissionsTray";
import LaunchOfferBanner from "@/components/ui/LaunchOfferBanner";
import MissionDetailSheet, { DetailMission, MissionRelation } from "@/components/swipe/MissionDetailSheet";
import { TitulaireMission } from "@/components/swipe/MissionSelector";
import ShareActions from "@/components/share/ShareActions";

interface Props {
  profileType: string;
  profileId: string;
  isPremium?: boolean;
  freeAccessMode?: boolean;
  titulaireMissions: TitulaireMission[];
  initialMissionId?: string;
  disponibiliteId?: string;
  cardMissionId?: string;
  isAdmin?: boolean;
}

export default function AnnoncesClient({ profileType, profileId, isPremium, freeAccessMode, titulaireMissions, initialMissionId, disponibiliteId, cardMissionId, isAdmin }: Props) {
  const [trayKey, setTrayKey] = useState(0);
  const [detail, setDetail] = useState<{ mission: DetailMission; relation: MissionRelation } | null>(null);

  // Confirmation de publication (section 163) — bannière de succès après création d'une annonce,
  // pour lever toute ambiguïté même si le feed de candidats est vide à cet instant.
  const searchParams = useSearchParams();
  const justPublished = searchParams.get("published") === "1";
  const publishedTitle = searchParams.get("pt") ?? "";
  const publishedId = searchParams.get("pid") ?? "";
  const [showPublished, setShowPublished] = useState(justPublished);

  // Ouverture de la fiche détaillée (bottom sheet) d'une annonce donnée, enrichie du statut
  // réel de l'utilisateur (swipe / mise en relation) — donc porteuse des décisions.
  const openCard = useCallback(async (missionId: string, opts?: { forgetIfGone?: boolean }) => {
    try {
      const r = await fetch(`/api/missions/${missionId}/card`);
      if (!r.ok) {
        // Annonce supprimée/introuvable → on la retire de l'historique pour ne plus la proposer.
        if (r.status === 404 && opts?.forgetIfGone) removeRecentMission(missionId, profileId);
        return;
      }
      const d = await r.json();
      setDetail({ mission: d.mission, relation: d.relation });
    } catch { /* silencieux */ }
  }, [profileId]);

  // Clic sur une annonce récente → même fiche que l'icône "i".
  const handleSelectRecent = useCallback((rm: RecentMission) => {
    void openCard(rm.id, { forgetIfGone: true });
  }, [openCard]);

  // Arrivée avec ?card=<id> (notification de consultation → page publique → « Voir la
  // recherche et se positionner ») : on ouvre cette fiche précise. Elle n'a pas à être dans
  // le feed du moment — le filtre de dates du chip sélectionné l'en écarte souvent, et le
  // lecteur se retrouvait alors sans aucun moyen de se prononcer.
  useEffect(() => {
    if (cardMissionId) void openCard(cardMissionId);
  }, [cardMissionId, openCard]);

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
      {/* Confirmation de publication (section 163) — non ambiguë, avec lien vers l'annonce. */}
      {showPublished && (
        <div className="shrink-0 bg-emerald-50 border-b border-emerald-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-emerald-800 min-w-0">
              ✅ <strong>Votre annonce{publishedTitle ? ` « ${publishedTitle} »` : ""} est en ligne</strong> — active et visible par les candidats.
              {publishedId && (
                <>
                  {" "}
                  <Link href={`/missions/create?editId=${encodeURIComponent(publishedId)}`} className="underline font-semibold whitespace-nowrap">
                    La voir / modifier
                  </Link>
                </>
              )}
            </p>
            <button
              onClick={() => setShowPublished(false)}
              aria-label="Fermer"
              className="shrink-0 text-emerald-500 hover:text-emerald-700 text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Partage à chaud. Le moment le plus motivé pour diffuser une annonce est celui où
              elle vient d'être publiée ; il fallait jusqu'ici repasser par le Planning, ouvrir
              l'entrée et y chercher la section de partage. Mêmes actions, même composant. */}
          {publishedId && (
            <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
              <p className="text-xs font-semibold text-emerald-700 shrink-0">Partagez-la maintenant :</p>
              <div className="w-full sm:w-auto sm:min-w-[260px]">
                <ShareActions path={`/annonce/${publishedId}`} title={publishedTitle || "Annonce"} />
              </div>
            </div>
          )}
        </div>
      )}

      <LaunchOfferBanner profileType={profileType} profileId={profileId} freeAccessMode={freeAccessMode} />
      <RecentMissionsTray onSelectMission={handleSelectRecent} profileId={profileId} />

      {/* Mobile : colonne (swipe + tray en bande bas). Desktop : deux colonnes (swipe centré + panneau latéral droit).
          La zone swipe reste flex-1 même à l'état vide (section 184) : le message vide se centre dans
          la zone et la bande « Vos mises en relation / Vos choix » (shrink-0) se dock EN BAS, contre le
          menu — fini le grand vide gris sous les trays. */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          <SwipeStack
            onSwipeRight={() => setTrayKey(k => k + 1)}
            profileType={profileType}
            profileId={profileId}
            titulaireMissions={titulaireMissions}
            initialMissionId={initialMissionId}
          />
        </div>

        <MatchTray isAdmin={isAdmin} refreshKey={trayKey} titulaireMissions={titulaireMissions} myProfileType={profileType} myProfileId={profileId} isPremium={isPremium} disponibiliteId={disponibiliteId} />
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
