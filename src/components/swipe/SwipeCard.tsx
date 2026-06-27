"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import Image from "next/image";
import { Mission, Profile } from "@prisma/client";

export type MissionWithProfile = Mission & { profile: Profile };

interface SwipeCardProps {
  mission: MissionWithProfile;
  onSwipe: (direction: "LEFT" | "RIGHT") => void;
  isTop: boolean;
}

export default function SwipeCard({ mission, onSwipe, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const likeOpacity = useTransform(x, [30, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, -30], [1, 0]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > 100) onSwipe("RIGHT");
    else if (info.offset.x < -100) onSwipe("LEFT");
  }

  const p = mission.profile;

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : null;

  const dateRange =
    mission.startDate && mission.endDate
      ? `${formatDate(mission.startDate)} → ${formatDate(mission.endDate)}`
      : mission.startDate
      ? `Dès le ${formatDate(mission.startDate)}`
      : null;

  const typeLabel =
    p.type === "REMPLACANT"
      ? "Remplaçant"
      : p.type === "ASSISTANT"
      ? "Assistant"
      : "Cabinet";

  const typeColor =
    p.type === "REMPLACANT"
      ? "bg-blue-500"
      : p.type === "ASSISTANT"
      ? "bg-violet-500"
      : "bg-emerald-600";

  return (
    <motion.div
      className="swipe-card absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 1.02 }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white flex flex-col">
        {/* Photo / Header */}
        <div className="relative h-[55%] bg-gradient-to-br from-kine-200 to-kine-500 flex-shrink-0">
          {p.photoUrl ? (
            <Image
              src={p.photoUrl}
              alt="Photo du profil"
              fill
              className="object-cover"
              sizes="(max-width: 480px) 100vw, 480px"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-7xl">
                {p.type === "REMPLACANT" ? "🩺" : p.type === "ASSISTANT" ? "👩‍⚕️" : "🏥"}
              </span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${typeColor}`}>
              {typeLabel}
            </span>
          </div>
          {p.isPaid && (
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-400 text-yellow-900">
                ⭐ Sponsorisé
              </span>
            </div>
          )}
        </div>

        {/* Infos mission */}
        <div className="flex-1 p-5 flex flex-col gap-2 overflow-hidden">
          <h3 className="font-bold text-gray-800 text-base leading-tight line-clamp-2">
            {mission.title}
          </h3>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>📍 {mission.location}</span>
            {p.ratingCount > 0 && (
              <span className="flex items-center gap-0.5 text-yellow-500 font-semibold">
                ★ {p.ratingAvg?.toFixed(1)}
                <span className="text-gray-400 font-normal text-xs">({p.ratingCount})</span>
              </span>
            )}
          </div>

          {mission.description && (
            <p className="text-gray-600 text-xs line-clamp-2">{mission.description}</p>
          )}

          {/* Plage de dates ou durée min */}
          {dateRange && (
            <div className="bg-kine-50 rounded-xl px-3 py-2 flex items-center gap-2 mt-auto">
              <span className="text-sm">📅</span>
              <span className="text-kine-700 text-xs font-medium">{dateRange}</span>
            </div>
          )}
          {mission.minMonths && (
            <div className="bg-violet-50 rounded-xl px-3 py-2 flex items-center gap-2 mt-auto">
              <span className="text-sm">⏱</span>
              <span className="text-violet-700 text-xs font-medium">
                {mission.minMonths} mois minimum
              </span>
            </div>
          )}

          {/* Spécialités */}
          {mission.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mission.specialties.slice(0, 3).map((s) => (
                <span key={s} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                  {s}
                </span>
              ))}
              {mission.specialties.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-400">
                  +{mission.specialties.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Overlay LIKE */}
        <motion.div
          className="absolute inset-0 bg-green-400/20 flex items-center justify-center pointer-events-none rounded-3xl"
          style={{ opacity: likeOpacity }}
        >
          <div className="border-4 border-green-500 rounded-2xl px-6 py-3 -rotate-12">
            <span className="text-green-500 font-black text-4xl tracking-wider">LIKE</span>
          </div>
        </motion.div>

        {/* Overlay NOPE */}
        <motion.div
          className="absolute inset-0 bg-red-400/20 flex items-center justify-center pointer-events-none rounded-3xl"
          style={{ opacity: nopeOpacity }}
        >
          <div className="border-4 border-red-500 rounded-2xl px-6 py-3 rotate-12">
            <span className="text-red-500 font-black text-4xl tracking-wider">NOPE</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
