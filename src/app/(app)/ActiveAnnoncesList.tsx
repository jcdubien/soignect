"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

// Liste partagée des annonces actives (section 141/157/163) — menu desktop + bottom sheet mobile.
// Titre → édition. Badges → candidatures. Icône poubelle → suppression rapide (confirmation
// inline + retrait optimiste), réutilise DELETE /api/missions/[id] (section 147 : nettoyage
// transactionnel + garde 409 si lié à un contrat confirmé → message renvoyant vers « Supprimer ce match »).
export default function ActiveAnnoncesList({
  missions,
  onItemClick,
}: {
  missions: ActiveMission[];
  onItemClick?: () => void;
}) {
  const router = useRouter();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; msg: string } | null>(null);

  async function doDelete(id: string) {
    setBusyId(id);
    setErrorId(null);
    try {
      const res = await fetch(`/api/missions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorId({ id, msg: typeof d?.error === "string" ? d.error : "Suppression impossible." });
        setBusyId(null);
        setConfirmingId(null);
        return;
      }
      // Retrait optimiste (l'item disparaît sans recharger toute la page) + resync serveur.
      setDeletedIds((prev) => new Set(prev).add(id));
      setBusyId(null);
      setConfirmingId(null);
      router.refresh();
    } catch {
      setErrorId({ id, msg: "Erreur réseau." });
      setBusyId(null);
    }
  }

  const visible = missions.filter((m) => !deletedIds.has(m.id));

  return (
    <>
      {visible.map((m) => {
        const pending = m.pendingCount ?? 0;
        const confirmed = m.confirmedCount ?? 0;
        const isConfirming = confirmingId === m.id;
        const err = errorId?.id === m.id ? errorId.msg : null;

        if (isConfirming) {
          return (
            <div key={m.id} className="px-4 py-3 bg-red-50 border-b border-red-100">
              <p className="text-sm text-gray-700 mb-2">Supprimer <strong>« {m.title} »</strong> ?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingId(null)}
                  disabled={busyId === m.id}
                  className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                >
                  Annuler
                </button>
                <button
                  onClick={() => doDelete(m.id)}
                  disabled={busyId === m.id}
                  className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-40"
                >
                  {busyId === m.id ? "…" : "Supprimer"}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={m.id} className="flex items-stretch hover:bg-gray-50 transition">
            {/* Titre/type/commune → édition (inchangé, section 141) */}
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
              {err && <span className="text-[11px] text-red-600 mt-0.5">{err}</span>}
            </Link>

            {/* Badges candidatures (section 159/163). Navigation via router.push explicite plutôt
                que <Link> : vers /annonces (route lente, force-dynamic), la transition d'un <Link>
                était avortée quand le menu se ferme (démontage) → badges « inopérants » sur mobile.
                router.push est une navigation GLOBALE, non liée au composant qui se démonte. */}
            <div className="shrink-0 flex items-center gap-1.5 pr-1 my-2">
              <button
                type="button"
                onClick={() => { router.push(`/annonces?missionId=${encodeURIComponent(m.id)}`); onItemClick?.(); }}
                title={`${pending} candidature${pending > 1 ? "s" : ""} en attente — swiper`}
                className={`flex items-center gap-1 px-2 h-8 rounded-lg text-xs font-bold transition ${
                  pending > 0 ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
              >
                <span>⏳</span><span>{pending}</span>
              </button>
              <button
                type="button"
                onClick={() => { router.push(`/annonces?disponibiliteId=${encodeURIComponent(m.id)}`); onItemClick?.(); }}
                title={`${confirmed} mise${confirmed > 1 ? "s" : ""} en relation confirmée${confirmed > 1 ? "s" : ""} — voir`}
                className={`flex items-center gap-1 px-2 h-8 rounded-lg text-xs font-bold transition ${
                  confirmed > 0 ? "bg-kine-600 text-white hover:bg-kine-700" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
              >
                <span>🤝</span><span>{confirmed}</span>
              </button>
            </div>

            {/* Suppression rapide (section 163) — icône discrète + confirmation inline */}
            <button
              type="button"
              onClick={() => { setConfirmingId(m.id); setErrorId(null); }}
              title="Supprimer cette annonce"
              aria-label="Supprimer cette annonce"
              className="shrink-0 w-9 flex items-center justify-center text-gray-300 hover:text-red-500 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        );
      })}
    </>
  );
}
