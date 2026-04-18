import { summarizeAndPersistEvalHistory } from '../../modules/runtime-metrics/services/runtime-metrics-store';
import type { PromptRegressionConfigSummary } from '../helpers/prompt-regression-summary';
import type { buildRuntimeCenter } from './runtime-runtime-center';
import { buildLearningCenter } from './runtime-learning-evidence-center';
import { buildSkillSourcesCenter } from './runtime-skill-sources-center';

export type RuntimeCenterRecord = ReturnType<typeof buildRuntimeCenter>;
export type LearningCenterRecord = Awaited<ReturnType<typeof buildLearningCenter>>;
export type EvalsCenterRecord = Awaited<ReturnType<typeof summarizeAndPersistEvalHistory>> & {
  promptRegression?: PromptRegressionConfigSummary;
};
export type SkillSourcesCenterRecord = ReturnType<typeof buildSkillSourcesCenter>;
