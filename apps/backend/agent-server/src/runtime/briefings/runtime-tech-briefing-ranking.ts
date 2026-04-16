import type { TechBriefingCategory, TechBriefingItem, TechBriefingSourceGroup } from './runtime-tech-briefing.types';
import { finalizeItemsForRanking } from './runtime-tech-briefing-ranking-finalize';
import { computePriorityScore } from './runtime-tech-briefing-ranking-policy';
import {
  extractRelevanceLevel,
  recommendedActionRank,
  relevanceLevelRank,
  sourceGroupRank
} from './runtime-tech-briefing-ranking-shared';

export { finalizeItemsForRanking } from './runtime-tech-briefing-ranking-finalize';

export function rankItems(
  category: TechBriefingCategory,
  items: TechBriefingItem[],
  sourcePolicy: 'tiered-authority' | 'official-only'
) {
  const filtered =
    sourcePolicy === 'official-only'
      ? items.filter(item => {
          if (item.sourceGroup === 'official') {
            return true;
          }
          if (category !== 'frontend-security' && category !== 'devtool-security') {
            return false;
          }
          return (
            item.sourceGroup === 'authority' &&
            item.contentKind === 'incident' &&
            (item.crossVerified || item.technicalityScore >= 4 || item.confidence >= 0.88)
          );
        })
      : items.filter(item => item.sourceGroup !== 'community' || item.crossVerified || item.technicalityScore >= 4);
  return filtered.sort((left, right) => {
    const repoGap = extractRelevanceLevel(right.relevanceReason) - extractRelevanceLevel(left.relevanceReason);
    if (repoGap !== 0) {
      return repoGap;
    }
    const explicitRelevanceGap = relevanceLevelRank(right.relevanceLevel) - relevanceLevelRank(left.relevanceLevel);
    if (explicitRelevanceGap !== 0) {
      return explicitRelevanceGap;
    }
    const actionGap = recommendedActionRank(right.recommendedAction) - recommendedActionRank(left.recommendedAction);
    if (actionGap !== 0) {
      return actionGap;
    }
    const groupGap = sourceGroupRank(right.sourceGroup) - sourceGroupRank(left.sourceGroup);
    if (groupGap !== 0) {
      return groupGap;
    }
    const priorityGap = computePriorityScore(category, right) - computePriorityScore(category, left);
    if (priorityGap !== 0) {
      return priorityGap;
    }
    if (right.crossVerified !== left.crossVerified) {
      return Number(right.crossVerified) - Number(left.crossVerified);
    }
    if (right.technicalityScore !== left.technicalityScore) {
      return right.technicalityScore - left.technicalityScore;
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return right.publishedAt.localeCompare(left.publishedAt);
  });
}
