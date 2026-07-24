import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import MatchChatButton from "@/components/chat/MatchChatButton";
import MatchStatusActions from "@/components/matches/MatchStatusActions";
import { ProfileType } from "@prisma/client";

export const dynamic = "force-dynamic";

// Horodatage compact d'un message (section 155) : heure si aujourd'hui, sinon date courte.
function fmtMsgTime(d: Date): string {
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Groupes de statut repliables (item 12) — Déclinées/Expirées repliées par défaut
const STATUS_GROUPS: { keys: string[]; label: string; defaultOpen: boolean }[] = [
  { keys: ["EN_ATTENTE"],          label: "En attente de réponse", defaultOpen: true },
  { keys: ["DISCUSSION"],          label: "Discussion en cours",   defaultOpen: true },
  { keys: ["CONFIRME"],            label: "Confirmées",            defaultOpen: true },
  { keys: ["DECLINE", "EXPIRE"],   label: "Déclinées / Expirées",  defaultOpen: false },
];

export default async function MatchesPage() {
  const session = await auth();
  // Guard propre : pas de session ou profil incomplet → redirection (pas de TypeError)
  const profileId = (session?.user as { profileId?: string })?.profileId;
  if (!profileId) redirect("/login");
  const myProfileId = profileId;

  const myProfile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { type: true },
  });
  const viewerType = (myProfile?.type ?? "REMPLACANT") as ProfileType;

  const allMatches = await prisma.match.findMany({
    where: { OR: [{ profileAId: profileId }, { profileBId: profileId }] },
    include: {
      profileA: true,
      profileB: true,
      missionA: true,
      missionB: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // 3e état du cycle de vie (section 183) : une relation dont le contrat est signé des DEUX
  // côtés SORT de la liste active « Relations » (pour ne pas l'encombrer de relations
  // finalisées). La donnée n'est PAS supprimée — elle reste accessible via la timeline (brique
  // confirmée → « Voir la fiche du match »). On filtre sur les signatures (bothSigned) et non
  // sur status=CONFIRME, qui peut être posé manuellement sans signature (état 2, à conserver).
  const matches = allMatches.filter((m) => !(m.signatureTitulaireUrl && m.signatureRemplacantUrl));

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

  // Aperçu de conversation (section 155) : dernier message + non-lus par match.
  const matchIds = matches.map((m) => m.id);
  const [lastMessages, unreadGroups] = await Promise.all([
    // Dernier message de chaque match (on récupère les récents et on garde le 1er par match).
    prisma.message.findMany({
      where: { matchId: { in: matchIds } },
      orderBy: { createdAt: "desc" },
      select: { matchId: true, content: true, createdAt: true, senderId: true },
    }),
    // Non-lus pour MOI = messages envoyés par l'autre, non lus.
    prisma.message.groupBy({
      by: ["matchId"],
      where: { matchId: { in: matchIds }, senderId: { not: profileId }, readAt: null },
      _count: { _all: true },
    }),
  ]);
  const lastByMatch = new Map<string, { content: string; createdAt: Date; senderId: string }>();
  for (const msg of lastMessages) {
    if (!lastByMatch.has(msg.matchId)) lastByMatch.set(msg.matchId, msg); // 1er = plus récent (tri desc)
  }
  const unreadByMatch = new Map<string, number>();
  for (const g of unreadGroups) unreadByMatch.set(g.matchId, g._count._all);

  const formatted = matches.map((m) => {
    const isA = m.profileAId === profileId;
    const theirMissionId = (isA ? m.missionBId : m.missionAId) ?? null;
    const affinityScore  = theirMissionId ? (swipeScore[theirMissionId] ?? null) : null;
    const last = lastByMatch.get(m.id) ?? null;

    return {
      ...m,
      otherProfile: isA ? m.profileB : m.profileA,
      myMission:    isA ? m.missionA : m.missionB,
      theirMission: isA ? m.missionB : m.missionA,
      affinityScore,
      lastMessage: last ? { content: last.content, at: last.createdAt, fromMe: last.senderId === profileId } : null,
      unreadCount: unreadByMatch.get(m.id) ?? 0,
      // Tri par activité : dernier message sinon date de création du match.
      lastActivityAt: (last?.createdAt ?? m.createdAt).getTime(),
    };
  });
  // Conversations les plus récemment actives en premier (section 155).
  formatted.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

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
            const groupItems = formatted.filter((m) => g.keys.includes((m as { status?: string }).status ?? "EN_ATTENTE"));
            if (groupItems.length === 0) return null;
            return (
            <details key={g.label} open={g.defaultOpen} className="group">
              <summary className="flex items-center gap-2 cursor-pointer list-none mb-2 select-none">
                <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{g.label} ({groupItems.length})</span>
              </summary>
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
                      {m.unreadCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                          {m.unreadCount > 9 ? "9+" : m.unreadCount}
                        </span>
                      )}
                    </div>
                    {m.theirMission && (
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.theirMission.title}</p>
                    )}
                    {/* Aperçu du dernier message (section 155) — remplace la ligne lieu s'il existe. */}
                    {m.lastMessage ? (
                      <p className={`text-xs truncate ${m.unreadCount > 0 ? "text-gray-700 font-semibold" : "text-gray-400"}`}>
                        {m.lastMessage.fromMe ? "Vous : " : ""}{m.lastMessage.content.length > 50 ? m.lastMessage.content.slice(0, 50).trimEnd() + "…" : m.lastMessage.content}
                        <span className="text-gray-300 font-normal"> · {fmtMsgTime(m.lastMessage.at)}</span>
                      </p>
                    ) : (
                      m.theirMission && <p className="text-xs text-gray-400">📍 {m.theirMission.location}</p>
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
                    myType={viewerType}
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
                {/* Recommandation retirée (section 78/79) — la notation vivra dans un
                    système dédié post-mission, séparé de l'écran de mise en relation. */}
              </div>
            );
          })}
              </div>
            </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
