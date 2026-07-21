"use client";

import Link from "next/link";

export interface ActiveMission {
  id: string;
  title: string;
  location: string;
  missionType: string;
  pendingCount?: number;   // likes reçus non encore matchés — « en attente » (section 157)
  confirmedCount?: number; // mises en relation confirmées
}

export const TYPE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat",
  COLLABORATION: "Collaboration",
};

// Liste partagée des annonces actives (section 141/157) — menu desktop + bottom sheet mobile.
// Le titre ouvre l'édition (/missions/create?editId=…). Deux badges distincts de candidatures :
//  ⏳ en attente → feed pour swiper les candidats intéressés (/annonces?missionId=…)
//  🤝 confirmées → vue filtrée des mises en relation (/annonces?disponibiliteId=…)
export default function ActiveAnnoncesList({
  missions,
  onItemClick,
}: {
  missions: ActiveMission[];
  onItemClick?: () => void;
}) {
  return (
    <>
      {missions.map((m) => {
        const pending = m.pendingCount ?? 0;
        const confirmed = m.confirmedCount ?? 0;
        return (
          <div key={m.id} className="flex items-stretch hover:bg-gray-50 transition">
            {/* Titre/type/commune → édition (comportement inchangé, section 141) */}
            <Link
              href={`/missions/create?editId=${m.id}`}
              onClick={onItemClick}
              className="flex-1 min-w-0 flex flex-col px-4 py-3"
              role="menuitem"
            >
              <span className="text-sm font-semibold text-gray-800 truncate">{m.title}</span>
              <span className="text-xs text-gray-400 truncate">
                {TYPE_LABEL[m.missionType] ?? m.missionType} · 📍 {m.location}
              </span>
            </Link>

            {/* Badges candidatures (section 157) — en attente / confirmées, chacun cliquable. */}
            <div className="shrink-0 flex items-center gap-1.5 pr-2 my-2">
              <Link
                href={`/annonces?missionId=${encodeURIComponent(m.id)}`}
                onClick={onItemClick}
                title={`${pending} candidature${pending > 1 ? "s" : ""} en attente — swiper`}
                className={`flex items-center gap-1 px-2 h-8 rounded-lg text-xs font-bold transition ${
                  pending > 0 ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
              >
                <span>⏳</span><span>{pending}</span>
              </Link>
              <Link
                href={`/annonces?disponibiliteId=${encodeURIComponent(m.id)}`}
                onClick={onItemClick}
                title={`${confirmed} mise${confirmed > 1 ? "s" : ""} en relation confirmée${confirmed > 1 ? "s" : ""} — voir`}
                className={`flex items-center gap-1 px-2 h-8 rounded-lg text-xs font-bold transition ${
                  confirmed > 0 ? "bg-kine-600 text-white hover:bg-kine-700" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
              >
                <span>🤝</span><span>{confirmed}</span>
              </Link>
            </div>
          </div>
        );
      })}
    </>
  );
}
