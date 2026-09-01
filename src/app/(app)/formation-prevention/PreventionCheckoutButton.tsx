"use client";

import { useState } from "react";

export default function PreventionCheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/prevention/checkout", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Impossible d'ouvrir le paiement");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Une erreur est survenue");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className="w-full rounded-xl bg-kine-600 px-5 py-3 font-bold text-white transition hover:bg-kine-700 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Ouverture du paiement…" : "Acheter la formation"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
