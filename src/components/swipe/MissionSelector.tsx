"use client";

export interface TitulaireMission {
  id: string;
  title: string;
  missionType: string;
  startDate: string | null;
  endDate: string | null;
  candidatesCount: number;
}

const TYPE_LABELS: Record<string, string> = {
  REMPLACEMENT:  "Remplacement",
  ASSISTANAT:    "Assistanat",
  COLLABORATION: "Collaboration",
};

function chipDateLabel(startDate: string | null, endDate: string | null, missionType: string): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  if (missionType === "REMPLACEMENT" && endDate) {
    const end = new Date(endDate);
    return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  }
  return `Dès ${start.toLocaleDateString("fr-FR", { month: "short" })}`;
}

interface Props {
  missions: TitulaireMission[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function MissionSelector({ missions, selectedId, onSelect }: Props) {
  if (missions.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto shrink-0"
      style={{ scrollbarWidth: "none" }}
    >
      {missions.map((m) => {
        const isActive = m.id === selectedId;
        const dateLabel = chipDateLabel(m.startDate, m.endDate, m.missionType);

        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`relative shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition border ${
              isActive
                ? "bg-kine-600 text-white border-kine-700 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-kine-300 hover:text-kine-700"
            }`}
          >
            {TYPE_LABELS[m.missionType] ?? m.missionType}
            {dateLabel && (
              <span className={isActive ? " text-kine-200" : " text-gray-400"}> · {dateLabel}</span>
            )}
            {m.candidatesCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {m.candidatesCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
