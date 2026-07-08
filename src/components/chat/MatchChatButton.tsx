"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ChatModal = dynamic(() => import("./ChatModal"), { ssr: false });

interface Props {
  matchId: string;
  myProfileId: string;
  partner: { type: string; theirMissionTitle?: string | null };
  aiScore: number | null;
  myType?: string;
}

export default function MatchChatButton({ matchId, myProfileId, partner, aiScore, myType }: Props) {
  const [open, setOpen] = useState(false);

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
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
