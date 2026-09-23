"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const ChatModal = dynamic(() => import("./ChatModal"), { ssr: false });

interface Props {
  matchId: string;
  myProfileId: string;
  partner: { type: string; theirMissionTitle?: string | null };
  aiScore: number | null;
  myType?: string;
  autoOpen?: boolean; // ouvre directement le chat (deep-link notif ?chat=1, section 183)
  /** Contrat signé des deux côtés — relayé tel quel à la modale (section 258). */
  contratConfirmed?: boolean;
}

export default function MatchChatButton({ matchId, myProfileId, partner, aiScore, myType, autoOpen, contratConfirmed }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 active:scale-[0.98] transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Ouvrir le chat
      </button>

      {open && (
        <ChatModal
          matchId={matchId}
          myProfileId={myProfileId}
          partner={partner}
          aiScore={aiScore}
          myType={myType}
          contratConfirmed={contratConfirmed}
          // ON NAVIGUE, ON NE RAFRAÎCHIT PAS. Premier essai : `router.refresh()`. Vérifié à
          // l'écran le 22/09 — la page `/match/[id]` décrit un match qui vient d'être supprimé,
          // le rafraîchissement tombait donc sur « Page introuvable ». Finir un geste délibéré
          // par une erreur 404 est une mauvaise fin de parcours : on mène à la liste, qui existe
          // toujours et reflète l'annulation. Depuis `/matches`, c'est un rafraîchissement.
          onCancelled={() => router.replace("/matches")}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
