"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-gray-400 hover:text-red-500 transition"
    >
      Déconnexion
    </button>
  );
}
