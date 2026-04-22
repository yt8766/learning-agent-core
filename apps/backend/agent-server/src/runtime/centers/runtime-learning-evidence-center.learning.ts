import {
  buildLearningCenter as buildLearningCenterProjection,
  type BuildLearningCenterInput
} from '../core/runtime-centers-facade';
import { buildRuleCandidates } from '../domain/learning/runtime-learning-derived-records';

export async function buildLearningCenter(input: BuildLearningCenterInput) {
  return buildLearningCenterProjection({
    ...input,
    deriveRuleCandidates: buildRuleCandidates
  });
}
