"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", textAlign: "center", padding: "1rem" }}>
        <span style={{ fontSize: "3rem" }}>⚠️</span>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1f2937" }}>Erreur critique</h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Une erreur inattendue s&apos;est produite.</p>
        <button
          onClick={reset}
          style={{ padding: "0.625rem 1.25rem", background: "#769CDF", color: "#fff", border: "none", borderRadius: "0.75rem", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
