import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SubscriptionPlan } from "@prisma/client";
import { hasPremiumAccess } from "@/lib/platform";
import MatchChatButton from "@/components/chat/MatchChatButton";
import MatchScoreBlock from "@/components/matches/MatchScoreBlock";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chat?: string }>;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function Avatar({ name, photoUrl, size = 16 }: { name?: string | null; photoUrl?: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-2xl flex items-center justify-center font-bold text-white text-xl overflow-hidden border-4 border-white shadow-lg`;
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <div className={cls}><img src={photoUrl} alt="" className="w-full h-full object-cover" /></div>;
  }
  return (
    <div className={`${cls} bg-gradient-to-br from-kine-400 to-kine-700`}>
      {initials(name)}
    </div>
  );
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { chat } = await searchParams;
  const session = await auth();
  if (!session?.user) return notFound();

  const profileId = (session.user as { profileId?: string }).profileId;
  if (!profileId) return notFound();

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      profileA: true,
      profileB: true,
      missionA: true,
      missionB: true,
    },
  });

  if (!match) return notFound();
  if (match.profileAId !== profileId && match.profileBId !== profileId) return notFound();

  const isA           = match.profileAId === profileId;
  const myProfile     = isA ? match.profileA : match.profileB;
  const theirProfile  = isA ? match.profileB : match.profileA;
  const theirMission  = isA ? match.missionB : match.missionA;

  // M1 — Score affinité depuis Swipe : c'est celui du lecteur, calculé au moment où il s'est
  // prononcé. Match.aiScore évalue le couple d'annonces et vaut null tant qu'il n'a pas été
  // calculé ; les deux sont désormais sur 0-100 (l'échelle 0-1 de Match.aiScore est corrigée).
  const theirMissionId = isA ? match.missionBId : match.missionAId;
  const mySwipe = theirMissionId
    ? await prisma.swipe.findFirst({
        where: { swiperId: profileId, swipedMissionId: theirMissionId },
        select: { affinityScore: true },
      })
    : null;
  const affinityScore = mySwipe?.affinityScore ?? null; // 0-100, déjà la bonne échelle

  const isPremium = await hasPremiumAccess({
    subscriptionPlan: (myProfile as typeof myProfile & { subscriptionPlan?: SubscriptionPlan }).subscriptionPlan,
    billingTriggeredAt: (myProfile as typeof myProfile & { billingTriggeredAt?: Date | null }).billingTriggeredAt,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 2 colonnes sur desktop (refonte layout, section 2) : résumé du match à gauche,
          actions (chat, contrat) à droite. Empilé sur mobile. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

      {/* ── En-tête ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-center gap-4 mb-5">
          <Avatar name={myProfile.name} photoUrl={myProfile.photoUrl} />
          <span className="text-2xl">💚</span>
          <Avatar name={theirProfile.name} photoUrl={theirProfile.photoUrl} />
        </div>

        <h1 className="text-center text-xl font-black text-gray-900 mb-0.5">
          Mise en relation confirmée
        </h1>
        <p className="text-center text-gray-400 text-sm mb-4">
          {theirProfile.name ?? "Profil"} et vous êtes compatibles
        </p>

        {/* Score affinité (0-100 depuis Swipe) */}
        {affinityScore !== null && (
          <>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Score d&apos;affinité</span>
              <span className="font-bold text-kine-600">{Math.round(affinityScore)}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-kine-500 rounded-full transition-all"
                style={{ width: `${Math.min(Math.round(affinityScore), 100)}%` }}
              />
            </div>
          </>
        )}

        {/* Compatibilité du couple d'annonces — calculable à la demande. Sans ce déclencheur,
            un score jamais calculé (ou remis à zéro après réaffectation) le restait à vie :
            la seule branche de scoring de l'API n'était atteignable par aucun écran. */}
        {match.missionA && match.missionB && (
          <MatchScoreBlock
            matchId={match.id}
            initialScore={match.aiScore}
            initialFactors={match.aiFactors as { availability: number; location: number; specialties: number; bio: number } | null}
          />
        )}

        {theirMission && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Annonce</p>
            <p className="text-sm font-semibold text-gray-800">{theirMission.title}</p>
            <p className="text-xs text-gray-400">📍 {theirMission.location}</p>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col gap-3">

        {/* 1. Conversation — INLINE (section 183) : la fiche est un point d'accès complet à
            elle seule. Une relation signée sort de « Relations » mais reste joignable ici via
            la timeline (brique confirmée → cette fiche), chat compris — plus de dépendance à
            la liste /matches. */}
        <MatchChatButton
          matchId={match.id}
          myProfileId={profileId}
          partner={{ type: theirProfile.type, theirMissionTitle: theirMission?.title ?? null }}
          aiScore={affinityScore}
          myType={myProfile.type}
          autoOpen={chat === "1"}
        />

        {/* 2. Contrat PDF — Premium uniquement */}
        {isPremium ? (
          <Link
            href={`/match/${match.id}/contrat`}
            className="w-full flex items-center justify-between px-5 py-4 bg-white border border-kine-200 text-kine-700 rounded-2xl font-semibold hover:bg-kine-50 active:scale-[0.98] transition"
          >
            <div>
              <p className="font-semibold text-sm">Générer le contrat PDF</p>
              <p className="text-kine-500 text-xs">Modèle CNOMK officiel pré-rempli</p>
            </div>
            <span className="text-lg">📄</span>
          </Link>
        ) : (
          /* Verrouillé (non-Premium) — jamais caché : clic → page /premium (item 8) */
          <Link
            href="/premium"
            className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 active:scale-[0.98] transition"
          >
            <div>
              <p className="text-gray-500 font-semibold text-sm">Générer le contrat PDF</p>
              <p className="text-gray-400 text-xs">Réservé aux abonnés Premium — débloquer</p>
            </div>
            <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Premium</span>
          </Link>
        )}

        {/* Recommandation retirée (section 78/79) — la notation vivra dans un
            système dédié post-mission, séparé de cet écran de mise en relation. */}
      </div>
      {/* fin grille 2 colonnes */}
      </div>

      <Link href="/annonces" className="block text-center text-sm text-gray-400 hover:text-kine-600 transition mt-6">
        ← Retour aux annonces
      </Link>
    </div>
  );
}
