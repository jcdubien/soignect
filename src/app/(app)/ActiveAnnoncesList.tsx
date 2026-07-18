"use client";

import Link from "next/link";

export interface ActiveMission {
  id: string;
  title: string;
  location: string;
  missionType: string;
}

export const TYPE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat",
  COLLABORATION: "Collaboration",
};

// Liste partagée des annonces actives (section 141) — réutilisée par le menu déroulant
// desktop (ActiveAnnoncesMenu) et le bottom sheet mobile (ActiveAnnoncesMobile). Chaque
// item ouvre l'édition via le flux existant /missions/create?editId=<id>.
export default function ActiveAnnoncesList({
  missions,
  onItemClick,
}: {
  missions: ActiveMission[];
  onItemClick?: () => void;
}) {
  return (
    <>
      {missions.map((m) => (
        <Link
          key={m.id}
          href={`/missions/create?editId=${m.id}`}
          onClick={onItemClick}
          className="flex flex-col px-4 py-3 hover:bg-gray-50 transition"
          role="menuitem"
        >
          <span className="text-sm font-semibold text-gray-800 truncate">{m.title}</span>
          <span className="text-xs text-gray-400 truncate">
            {TYPE_LABEL[m.missionType] ?? m.missionType} · 📍 {m.location}
          </span>
        </Link>
      ))}
    </>
  );
}
