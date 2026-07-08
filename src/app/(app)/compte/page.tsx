import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CompteForm from "./CompteForm";

export const dynamic = "force-dynamic";

export default async function ComptePage({ searchParams }: { searchParams: Promise<{ photoError?: string }> }) {
  const { photoError } = await searchParams;
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
      <CompteForm profile={profile} matchedMissions={matchedMissions} />
    </>
  );
}
