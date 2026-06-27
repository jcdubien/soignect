"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard, { type MissionWithProfile } from "./SwipeCard";
import SwipeButtons from "./SwipeButtons";

interface SwipeDeckProps {
  initialMissions: MissionWithProfile[];
}

interface MatchResult {
  id: string;
  aiScore: number | null;
}

export default function SwipeDeck({ initialMissions }: SwipeDeckProps) {
  const [missions, setMissions] = useState(initialMissions);
  const [lastMatch, setLastMatch] = useState<MatchResult | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [swiping, setSwiping] = useState(false);

  const current = missions[missions.length - 1];
  const hasSecond = missions.length >= 2;

  const handleSwipe = useCallback(
    async (direction: "LEFT" | "RIGHT") => {
      if (!current || swiping) return;
      setSwiping(true);

      try {
        const res = await fetch("/api/swipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ swipedMissionId: current.id, direction }),
        });
        const data = await res.json();
        if (data.match) {
          setLastMatch(data.match);
          setShowMatch(true);
        }
      } catch {
        // Swipe enregistré localement même en cas d'erreur réseau
      }

      setMissions((prev) => prev.slice(0, -1));
      setSwiping(false);
    },
    [current, swiping]
  );

  // Pré-chargement quand il reste peu de missions
  useEffect(() => {
    if (missions.length < 3) {
      fetch("/api/missions?limit=10")
        .then((r) => r.json())
        .then((fresh: MissionWithProfile[]) => {
          const existingIds = new Set(missions.map((m) => m.id));
          const newOnes = fresh.filter((m) => !existingIds.has(m.id));
          if (newOnes.length > 0) setMissions((prev) => [...newOnes, ...prev]);
        })
        .catch(() => {});
    }
  }, [missions.length]);

  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <span className="text-6xl">🌊</span>
        <h3 className="text-xl font-semibold text-gray-700">
          Plus d&apos;annonces disponibles
        </h3>
        <p className="text-gray-400 text-sm">
          Revenez plus tard ou publiez de nouvelles missions !
        </p>
        <a
          href="/missions/create"
          className="mt-2 px-6 py-3 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition"
        >
          + Nouvelle annonce
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Pile de cartes */}
      <div className="relative flex-1 mx-4 mt-2 mb-2">
        {hasSecond && (
          <div
            className="absolute inset-0 rounded-3xl bg-white shadow-lg"
            style={{ transform: "scale(0.95) translateY(8px)", zIndex: 0 }}
          />
        )}
        <AnimatePresence>
          {current && (
            <motion.div
              key={current.id}
              className="absolute inset-0"
              style={{ zIndex: 1 }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ x: 0, opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            >
              <SwipeCard mission={current} onSwipe={handleSwipe} isTop={true} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SwipeButtons
        onNope={() => handleSwipe("LEFT")}
        onLike={() => handleSwipe("RIGHT")}
        disabled={swiping || !current}
      />

      {/* Modal Match */}
      <AnimatePresence>
        {showMatch && lastMatch && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMatch(false)}
          >
            <motion.div
              className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl"
              initial={{ scale: 0.7, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-kine-700 mb-2">C&apos;est un match !</h2>
              {lastMatch.aiScore !== null && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1">Compatibilité IA</p>
                  <p className="text-4xl font-bold text-kine-600">
                    {Math.round(lastMatch.aiScore * 100)}%
                  </p>
                </div>
              )}
              <p className="text-gray-500 text-sm mb-6">
                Vous vous êtes mutuellement sélectionnés sur cette annonce.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMatch(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm"
                >
                  Continuer
                </button>
                <a
                  href="/matches"
                  className="flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 transition text-sm text-center"
                >
                  Voir mes matches
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
