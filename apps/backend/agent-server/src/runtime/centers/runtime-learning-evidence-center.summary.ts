import {
  buildLearningCenterSummary as buildLearningCenterSummaryProjection,
  type BuildLearningCenterInput
} from '@agent/runtime';
import { buildRuleCandidates } from '../domain/learning/runtime-learning-derived-records';

export async function buildLearningCenterSummary(input: BuildLearningCenterInput) {
  return buildLearningCenterSummaryProjection({
    ...input,
    deriveRuleCandidates: buildRuleCandidates
  });
}
