"use client";

import Link from "next/link";

export interface ActiveMission {
  id: string;
  title: string;
  location: string;
  missionType: string;
  relationCount?: number; // mises en relation en cours sur cette annonce (section 157)
}

export const TYPE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat",
  COLLABORATION: "Collaboration",
};

// Liste partagée des annonces actives (section 141) — réutilisée par le menu déroulant
// desktop (ActiveAnnoncesMenu) et le bottom sheet mobile (ActiveAnnoncesMobile).
// Le titre ouvre l'édition (/missions/create?editId=…) ; le badge de candidatures (section 157)
// mène directement à la vue filtrée des mises en relation de CETTE annonce.
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
        const count = m.relationCount ?? 0;
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
            {/* Badge candidatures → vue filtrée des mises en relation de cette annonce (section 157) */}
            <Link
              href={`/annonces?disponibiliteId=${encodeURIComponent(m.id)}`}
              onClick={onItemClick}
              title={count > 0 ? `${count} mise${count > 1 ? "s" : ""} en relation — voir` : "Voir les mises en relation"}
              className={`shrink-0 flex items-center gap-1 px-3 my-2 mr-2 rounded-lg text-xs font-bold transition ${
                count > 0
                  ? "bg-kine-600 text-white hover:bg-kine-700"
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
            >
              <span>🤝</span>
              <span>{count}</span>
            </Link>
          </div>
        );
      })}
    </>
  );
}
