import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import RatingsClient from "./RatingsClient";

export default async function AdminRatingsPage() {
  const ratings = await prisma.cabinetRating.findMany({
    where: { isPublished: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      recommended: true,
      comment: true,
      scoreGlobal: true,
      scoreAccueil: true,
      scoreMateriel: true,
      scoreContrat: true,
      scoreAmbiance: true,
      isPublished: true,
      createdAt: true,
      rater: { select: { id: true, name: true, type: true } },
      rated: { select: { id: true, name: true, type: true } },
    },
  });

  return <RatingsClient initialRatings={JSON.parse(JSON.stringify(ratings))} />;
}
