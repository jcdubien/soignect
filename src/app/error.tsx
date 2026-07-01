"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl">⚠️</span>
      <h2 className="text-xl font-bold text-gray-800">Une erreur est survenue</h2>
      <p className="text-gray-500 text-sm max-w-sm">{error.message ?? "Erreur inattendue. Veuillez réessayer."}</p>
      <button
        onClick={reset}
        className="px-5 py-2.5 bg-kine-600 text-white text-sm font-semibold rounded-xl hover:bg-kine-700 transition"
      >
        Réessayer
      </button>
      <Link href="/annonces" className="text-sm text-gray-400 hover:text-kine-600 transition">
        Retour aux annonces
      </Link>
    </div>
  );
}
