"use client";

import { useState } from "react";

interface RatingFormProps {
  ratedId: string;
  matchId: string;
}

export default function RatingForm({ ratedId, matchId }: RatingFormProps) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!score) return;
    setLoading(true);

    await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratedId, matchId, score, comment }),
    });

    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <p className="text-sm text-kine-600 font-medium">✓ Note envoyée, merci !</p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onClick={() => setScore(i)}
            className={`text-xl transition ${
              i <= score ? "text-yellow-400" : "text-gray-200 hover:text-yellow-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {score > 0 && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-kine-500 text-white rounded-full hover:bg-kine-600 transition disabled:opacity-50"
        >
          {loading ? "…" : "Envoyer"}
        </button>
      )}
    </div>
  );
}
