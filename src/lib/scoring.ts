import type { Campsite, PreferenceProfile, RatingMap, MonthRatingMap } from '../types';

function weightedAverage<T extends string>(
  values: Partial<Record<T, number>>,
  weights: Record<T, number>,
): number | null {
  let total = 0;
  let activeWeight = 0;

  for (const [key, rawValue] of Object.entries(values) as [T, number][]) {
    if (!Number.isFinite(rawValue)) continue;
    const weight = weights[key] ?? 0;
    if (weight <= 0) continue;
    total += rawValue * weight;
    activeWeight += weight;
  }

  return activeWeight > 0 ? total / activeWeight : null;
}

export function calculateSiteQuality(values: RatingMap, profile: PreferenceProfile): number | null {
  return weightedAverage(values, profile.criterionWeights);
}

export function calculateSeasonalFit(values: MonthRatingMap, profile: PreferenceProfile): number | null {
  return weightedAverage(values, profile.monthWeights);
}

export function calculateOverall(site: Campsite, profile: PreferenceProfile): number | null {
  const siteQuality = calculateSiteQuality(site.currentFacts, profile);
  const seasonalFit = calculateSeasonalFit(site.seasonalRatings, profile);

  if (siteQuality === null) return seasonalFit;
  if (seasonalFit === null) return siteQuality;

  const totalShare = profile.siteQualityShare + profile.seasonalShare;
  if (totalShare <= 0) return siteQuality;

  return (
    siteQuality * (profile.siteQualityShare / totalShare) +
    seasonalFit * (profile.seasonalShare / totalShare)
  );
}

export function scoreClass(score: number | null): string {
  if (score === null) return 'score-empty';
  if (score >= 4.5) return 'score-excellent';
  if (score >= 4) return 'score-good';
  if (score >= 3) return 'score-fair';
  if (score >= 2) return 'score-poor';
  return 'score-bad';
}

export function formatScore(score: number | null): string {
  return score === null ? '—' : score.toFixed(2);
}
