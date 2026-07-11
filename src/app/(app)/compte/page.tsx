import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import CompteForm from "./CompteForm";

export const dynamic = "force-dynamic";

// Sécurité : n'autoriser que des chemins internes relatifs comme cible de retour.
function safeReturnTo(v?: string): string | null {
  if (!v) return null;
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default async function ComptePage({ searchParams }: { searchParams: Promise<{ photoError?: string; returnTo?: string }> }) {
  const { photoError, returnTo: rawReturnTo } = await searchParams;
  const returnTo = safeReturnTo(rawReturnTo);
  const session = await auth();
  if (!session?.user?.profileId) redirect("/login");

  const profileId = session.user.profileId as string;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      name: true,
      bio: true,
      bioTinder: true,
      region: true,
      profession: true,
      isVerified: true,
      subscriptionPlan: true,
      isFounding: true,
      type: true,
      photoUrl: true,
      secondaryPhotoUrl1: true,
      secondaryPhotoUrl2: true,
      isEmployeur: true,
      user: { select: { phone: true, phoneCountry: true, emailOptIn: true } },
    },
  });

  if (!profile) redirect("/login");

  // Pour REMPLACANT : charger les missions matchées pour la timeline
  let matchedMissions: {
    matchId: string;
    missionTitle: string;
    cabinetName: string | null;
    startDate: Date | null;
    endDate: Date | null;
    location: string | null;
  }[] = [];

  if (profile.type === "REMPLACANT" || profile.type === "ASSISTANT") {
    const matchesA = await prisma.match.findMany({
      where: { profileAId: profileId },
      select: {
        id: true,
        missionA: { select: { title: true, startDate: true, endDate: true, location: true } },
        profileB: { select: { name: true } },
      },
    });
    const matchesB = await prisma.match.findMany({
      where: { profileBId: profileId },
      select: {
        id: true,
        missionB: { select: { title: true, startDate: true, endDate: true, location: true } },
        profileA: { select: { name: true } },
      },
    });

    matchedMissions = [
      ...matchesA
        .filter(m => m.missionA)
        .map(m => ({
          matchId: m.id,
          missionTitle: m.missionA!.title,
          cabinetName: m.profileB?.name ?? null,
          startDate: m.missionA!.startDate,
          endDate: m.missionA!.endDate,
          location: m.missionA!.location,
        })),
      ...matchesB
        .filter(m => m.missionB)
        .map(m => ({
          matchId: m.id,
          missionTitle: m.missionB!.title,
          cabinetName: m.profileA?.name ?? null,
          startDate: m.missionB!.startDate,
          endDate: m.missionB!.endDate,
          location: m.missionB!.location,
        })),
    ];
  }

  return (
    <>
      {photoError && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            ✅ Votre compte a bien été créé. En revanche l&apos;envoi de votre photo a échoué —
            vous pouvez l&apos;ajouter dès maintenant ci-dessous.
          </div>
        </div>
      )}
      {/* Bandeau de retour vers l'annonce en cours (item 15) */}
      {returnTo && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="bg-kine-50 border border-kine-200 rounded-xl px-4 py-3 text-sm text-kine-800 flex items-center justify-between gap-3">
            <span>
              {profile.photoUrl
                ? "✓ Photo ajoutée — vous pouvez reprendre votre annonce."
                : "Ajoutez votre photo ci-dessous, puis reprenez votre annonce."}
            </span>
            <Link href={returnTo} className="shrink-0 font-semibold text-kine-700 underline hover:text-kine-900">
              Reprendre mon annonce →
            </Link>
          </div>
        </div>
      )}
      <CompteForm profile={profile} matchedMissions={matchedMissions} />
    </>
  );
}
