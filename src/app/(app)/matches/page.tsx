import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import RatingForm from "@/components/swipe/RatingForm";

export default async function MatchesPage() {
  const session = await auth();
  const profileId = session!.user.profileId!;

  const matches = await prisma.match.findMany({
    where: { OR: [{ profileAId: profileId }, { profileBId: profileId }] },
    include: {
      profileA: true,
      profileB: true,
      missionA: true,
      missionB: true,
      ratings: { where: { raterId: profileId } },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = matches.map((m) => {
    const isA = m.profileAId === profileId;
    return {
      ...m,
      otherProfile: isA ? m.profileB : m.profileA,
      myMission: isA ? m.missionA : m.missionB,
      theirMission: isA ? m.missionB : m.missionA,
      hasRated: m.ratings.length > 0,
      myRating: m.ratings[0] ?? null,
    };
  });

  return (
    <div className="max-w-xl mx-auto w-full px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Mes matches ({formatted.length})
      </h1>

      {formatted.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl">💚</span>
          <p className="text-gray-500 mt-4">Pas encore de match. Continuez à swiper !</p>
        </div>
      ) : (
        <div className="space-y-4">
          {formatted.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-kine-100 flex-shrink-0">
                  {m.otherProfile.photoUrl ? (
                    <Image src={m.otherProfile.photoUrl} alt="Photo" fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-2xl">
                      {m.otherProfile.type === "REMPLACANT" ? "🩺" : m.otherProfile.type === "ASSISTANT" ? "👩‍⚕️" : "🏥"}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.otherProfile.type === "REMPLACANT" ? "bg-blue-100 text-blue-700"
                      : m.otherProfile.type === "ASSISTANT" ? "bg-violet-100 text-violet-700"
                      : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {m.otherProfile.type === "REMPLACANT" ? "Remplaçant" : m.otherProfile.type === "ASSISTANT" ? "Assistant" : "Cabinet"}
                    </span>
                    {m.aiScore !== null && (
                      <span className="text-xs text-kine-600 font-semibold">
                        {Math.round(m.aiScore * 100)}% compatible
                      </span>
                    )}
                  </div>
                  {m.theirMission && (
                    <p className="text-sm font-medium text-gray-800 truncate">{m.theirMission.title}</p>
                  )}
                  {m.theirMission && (
                    <p className="text-xs text-gray-400">📍 {m.theirMission.location}</p>
                  )}
                </div>
              </div>

              {/* Mission matchée */}
              {m.myMission && (
                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                  Sur votre annonce : <span className="text-gray-600 font-medium">{m.myMission.title}</span>
                </div>
              )}

              {/* Notation */}
              {!m.hasRated && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">
                    Notez ce profil après votre échange :
                  </p>
                  <RatingForm ratedId={m.otherProfile.id} matchId={m.id} />
                </div>
              )}
              {m.hasRated && m.myRating && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={`text-sm ${i <= m.myRating!.score ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">Votre note</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
