import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import ProfilesClient from "./ProfilesClient";

export default async function AdminProfilesPage() {
  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      profession: true,
      region: true,
      subscriptionPlan: true,
      isVerified: true,
      isFounding: true,
      institutionalPartner: true,
      isActive: true,
      desirabilityScore: true,
      desirabilityOverride: true,
      desirabilityExpiry: true,
      weight: true,
      createdAt: true,
      user: { select: { email: true } },
      _count: { select: { missions: { where: { isActive: true } } } },
    },
  });

  return <ProfilesClient initialProfiles={JSON.parse(JSON.stringify(profiles))} />;
}
