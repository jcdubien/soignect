"use client";

import { useState, useCallback } from "react";
import SwipeStack from "@/components/swipe/SwipeStack";
import MatchTray from "@/components/swipe/MatchTray";
import RecentMissionsTray, { RecentMission } from "@/components/swipe/RecentMissionsTray";
import { TitulaireMission } from "@/components/swipe/MissionSelector";

interface Props {
  profileType: string;
  titulaireMissions: TitulaireMission[];
  initialMissionId?: string;
}

export default function AnnoncesClient({ profileType, titulaireMissions, initialMissionId }: Props) {
  const [trayKey,      setTrayKey]      = useState(0);
  const [sheetMission, setSheetMission] = useState<RecentMission | null>(null);

  const handleSelectRecent = useCallback((mission: RecentMission) => {
    setSheetMission(mission);
  }, []);

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

      <MatchTray refreshKey={trayKey} />

      {sheetMission && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/50"
          onClick={() => setSheetMission(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{sheetMission.title}</h2>
                  <p className="text-sm text-gray-400">📍 {sheetMission.location}</p>
                </div>
                <button
                  onClick={() => setSheetMission(null)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              {sheetMission.description && (
                <p className="text-gray-600 text-sm mb-3">{sheetMission.description}</p>
              )}
              {sheetMission.startDate && (
                <p className="text-sm text-gray-500 mb-2">
                  📅 {new Date(sheetMission.startDate).toLocaleDateString("fr-FR")}
                  {sheetMission.endDate && ` → ${new Date(sheetMission.endDate).toLocaleDateString("fr-FR")}`}
                </p>
              )}
              {(sheetMission.specialties?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sheetMission.specialties!.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
