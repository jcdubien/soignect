"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PostData, UnlinkedMission } from "./modele";

// Rattachement a posteriori d'une annonce non rattachée à un poste (15/11) — voir
// PUT /api/missions/[id]/poste. Le serveur rejoue toutes les règles ; ce composant se contente
// de ne pas proposer ce qui serait refusé à coup sûr (poste fermé, siège du titulaire pour autre
// chose qu'un remplacement, annonce sans date de début).
export function RattacherAPoste({ mission, posts }: { mission: UnlinkedMission; posts: PostData[] }) {
  const router = useRouter();
  const candidats = posts.filter(
    (p) => p.isActive && (!p.isOwnerSeat || mission.missionType === "REMPLACEMENT"),
  );
  const [postId, setPostId] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (candidats.length === 0) return null;

  if (!mission.startDate && mission.briqueStatus === "RECHERCHE") {
    return (
      <p className="mt-2 text-[11px] text-gray-500">
        Pour rattacher cette annonce à un poste, ajoutez-lui d&apos;abord une date de début (« Modifier ») :
        c&apos;est elle qui la place sur la ligne du poste.
      </p>
    );
  }

  async function rattacher() {
    if (!postId || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/missions/${encodeURIComponent(mission.id)}/poste`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cabinetPostId: postId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErreur(data?.error ?? "Le rattachement n'a pas abouti. Réessayez.");
        setEnCours(false);
        return;
      }
      router.refresh();
    } catch {
      setErreur("Erreur réseau. Réessayez.");
      setEnCours(false);
    }
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-gray-100">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Rattacher à un poste</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={postId}
          onChange={(e) => { setPostId(e.target.value); setErreur(null); }}
          className="min-w-0 max-w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700"
        >
          <option value="">Choisir un poste…</option>
          {candidats.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={rattacher}
          disabled={!postId || enCours}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-kine-600 text-white hover:bg-kine-700 transition disabled:opacity-40"
        >
          {enCours ? "Rattachement…" : "Rattacher"}
        </button>
      </div>
      {erreur && <p className="mt-1.5 text-[11px] text-red-600">{erreur}</p>}
    </div>
  );
}
