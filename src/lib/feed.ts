import { Profile } from "@prisma/client";

const MAX_WEIGHT = 3.0;
const DEFAULT_RATING_NORM = 0.5;

export function computeFeedScore(profile: Profile, aiScore: number): number {
  const effectiveWeight = profile.isPaid
    ? Math.max(profile.weight, 2.0)
    : profile.weight;

  const weightNorm = Math.min(effectiveWeight, MAX_WEIGHT) / MAX_WEIGHT;
  const ratingNorm =
    profile.ratingCount > 0
      ? (profile.ratingAvg ?? 0) / 5.0
      : DEFAULT_RATING_NORM;

  return aiScore * 0.5 + weightNorm * 0.3 + ratingNorm * 0.2;
}

export function sortByFeedScore(
  profiles: Array<Profile & { aiScore?: number }>
): Array<Profile & { aiScore?: number }> {
  return [...profiles].sort((a, b) => {
    const scoreA = computeFeedScore(a, a.aiScore ?? 0.5);
    const scoreB = computeFeedScore(b, b.aiScore ?? 0.5);
    return scoreB - scoreA;
  });
}
