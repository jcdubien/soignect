"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      aria-label="Déconnexion"
      title="Déconnexion"
      className="shrink-0 text-sm text-gray-400 hover:text-red-500 transition inline-flex items-center gap-1"
    >
      {/* Mobile : icône compacte (évite la troncature « Déconnexio… » dans le header étroit).
          Desktop (sm+) : libellé complet. */}
      <svg
        className="sm:hidden"
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span className="hidden sm:inline whitespace-nowrap">Déconnexion</span>
    </button>
  );
}
