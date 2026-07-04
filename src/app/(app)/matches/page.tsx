import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import RecommendationForm from "@/components/swipe/RecommendationForm";
import MatchChatButton from "@/components/chat/MatchChatButton";
import MatchStatusActions from "@/components/matches/MatchStatusActions";
import { ProfileType } from "@prisma/client";

export const dynamic = "force-dynamic";

// Groupes de statut (item 12)
const STATUS_GROUPS: { key: string; label: string }[] = [
  { key: "EN_ATTENTE", label: "En attente" },
  { key: "DISCUSSION", label: "En discussion" },
  { key: "CONFIRME",   label: "Confirmées" },
  { key: "DECLINE",    label: "Déclinées" },
  { key: "EXPIRE",     label: "Expirées" },
];

export default async function MatchesPage() {
  const session = await auth();
  const profileId = session!.user.profileId!;
  const myProfileId = profileId;

  const myProfile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { type: true },
  });
  const viewerType = (myProfile?.type ?? "REMPLACANT") as ProfileType;

  const matches = await prisma.match.findMany({
    where: { OR: [{ profileAId: profileId }, { profileBId: profileId }] },
    include: {
      profileA: true,
      profileB: true,
      missionA: true,
      missionB: true,
      // Notation avec les nouveaux modèles
      cabinetRatings:    { where: { raterId: profileId } },
      remplacantRatings: { where: { raterId: profileId } },
    },
    orderBy: { createdAt: "desc" },
  });

  // M1 — Récupérer les Swipe.affinityScore pour afficher le score 0-100 correct
  const theirMissionIds = matches.map(m => {
    const isA = m.profileAId === profileId;
    return isA ? m.missionBId : m.missionAId;
  }).filter(Boolean) as string[];

  const mySwipes = await prisma.swipe.findMany({
    where: { swiperId: profileId, swipedMissionId: { in: theirMissionIds } },
    select: { swipedMissionId: true, affinityScore: true },
  });
  const swipeScore: Record<string, number | null> = {};
  for (const s of mySwipes) swipeScore[s.swipedMissionId] = s.affinityScore;

  const formatted = matches.map((m) => {
    const isA = m.profileAId === profileId;
    const theirMissionId = (isA ? m.missionBId : m.missionAId) ?? null;
    const affinityScore  = theirMissionId ? (swipeScore[theirMissionId] ?? null) : null;

    // "A-t-il déjà évalué ?" — selon le type du viewer
    const hasRated = viewerType === "TITULAIRE"
      ? m.remplacantRatings.length > 0
      : m.cabinetRatings.length > 0;

    const didRecommend: boolean | null = viewerType === "TITULAIRE"
      ? (m.remplacantRatings[0]?.recommended ?? null)
      : (m.cabinetRatings[0]?.recommended ?? null);

    return {
      ...m,
      otherProfile: isA ? m.profileB : m.profileA,
      myMission:    isA ? m.missionA : m.missionB,
      theirMission: isA ? m.missionB : m.missionA,
      affinityScore,
      hasRated,
      didRecommend,
    };
  });

  const typeConfig = (type: string) => ({
    REMPLACANT: { label: "Remplaçant·e", badge: "bg-blue-100 text-blue-700",      emoji: "🩺" },
    ASSISTANT:  { label: "Assistant·e",  badge: "bg-violet-100 text-violet-700",  emoji: "👩‍⚕️" },
    TITULAIRE:  { label: "Cabinet",      badge: "bg-emerald-100 text-emerald-700", emoji: "🏥" },
  }[type] ?? { label: type, badge: "bg-gray-100 text-gray-600", emoji: "👤" });

  return (
    <div className="max-w-xl mx-auto w-full px-4 py-6 animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">
          Mes mises en relation
          {formatted.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">({formatted.length})</span>
          )}
        </h1>
        <Link
          href="/annonces"
          className="text-xs px-3 py-1.5 bg-kine-100 text-kine-700 rounded-lg font-medium hover:bg-kine-200 transition"
        >
          ← Annonces
        </Link>
      </div>

      {formatted.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">💚</div>
          <p className="text-gray-500 font-medium">Pas encore de mise en relation</p>
          <p className="text-gray-400 text-sm mt-1">Continuez à explorer les annonces pour trouver des profils compatibles !</p>
          <Link
            href="/annonces"
            className="inline-block mt-6 px-6 py-3 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition"
          >
            Voir les annonces
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_GROUPS.map((g) => {
            const groupItems = formatted.filter((m) => ((m as { status?: string }).status ?? "EN_ATTENTE") === g.key);
            if (groupItems.length === 0) return null;
            return (
            <section key={g.key}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{g.label} ({groupItems.length})</h2>
              <div className="space-y-4">
          {groupItems.map((m) => {
            const tc    = typeConfig(m.otherProfile.type);
            const score = m.affinityScore !== null ? Math.round(m.affinityScore) : null;
            const scoreColor =
              score === null ? "" :
              score >= 80 ? "text-emerald-600" :
              score >= 50 ? "text-kine-600" : "text-amber-500";

            return (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* En-tête match */}
                <div className="p-4 flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-kine-200 to-kine-400 flex-shrink-0 shadow-sm">
                    {m.otherProfile.photoUrl ? (
                      <Image src={m.otherProfile.photoUrl} alt="Photo" fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-2xl">{tc.emoji}</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tc.badge}`}>
                        {tc.label}
                      </span>
                      {score !== null && (
                        <span className={`text-xs font-bold ${scoreColor}`}>
                          {score}% compatible
                        </span>
                      )}
                    </div>
                    {m.theirMission && (
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.theirMission.title}</p>
                    )}
                    {m.theirMission && (
                      <p className="text-xs text-gray-400">📍 {m.theirMission.location}</p>
                    )}
                  </div>

                  {score !== null && (
                    <div className={`text-center flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                      score >= 80 ? "bg-emerald-50" : score >= 50 ? "bg-kine-50" : "bg-amber-50"
                    }`}>
                      <span className={`text-base font-black ${scoreColor}`}>{score}</span>
                      <span className="text-[9px] text-gray-400 font-medium">%</span>
                    </div>
                  )}
                </div>

                {/* Barre de compatibilité */}
                {score !== null && (
                  <div className="px-4 pb-1">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          score >= 80 ? "bg-emerald-400" : score >= 50 ? "bg-kine-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Ma mission */}
                {m.myMission && (
                  <div className="px-4 pb-3 pt-2 text-xs text-gray-400 border-t border-gray-50 mt-1">
                    Votre annonce :{" "}
                    <span className="text-gray-600 font-medium">{m.myMission.title}</span>
                  </div>
                )}

                {/* Chat */}
                <div className="px-4 py-2.5 border-t border-gray-50">
                  <MatchChatButton
                    matchId={m.id}
                    myProfileId={myProfileId}
                    partner={{ type: m.otherProfile.type, theirMissionTitle: m.theirMission?.title ?? null }}
                    aiScore={m.affinityScore}
                  />
                </div>

                {/* Actions statut — Confirmer / Décliner (item 12) */}
                {((m as { status?: string }).status ?? "EN_ATTENTE") !== "CONFIRME" &&
                 ((m as { status?: string }).status ?? "EN_ATTENTE") !== "DECLINE" &&
                 ((m as { status?: string }).status ?? "EN_ATTENTE") !== "EXPIRE" && (
                  <div className="px-4 py-2.5 border-t border-gray-50">
                    <MatchStatusActions matchId={m.id} status={(m as { status?: string }).status ?? "EN_ATTENTE"} />
                  </div>
                )}

                {/* Recommandation binaire */}
                <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/50">
                  {m.hasRated ? (
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        m.didRecommend
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {m.didRecommend ? "Recommandé 👍" : "Non recommandé 👎"}
                      </span>
                      <span className="text-xs text-gray-400">Votre évaluation</span>
                    </div>
                  ) : (
                    <RecommendationForm
                      matchId={m.id}
                      ratedId={m.otherProfile.id}
                      viewerType={viewerType}
                    />
                  )}
                </div>
              </div>
            );
          })}
              </div>
            </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
