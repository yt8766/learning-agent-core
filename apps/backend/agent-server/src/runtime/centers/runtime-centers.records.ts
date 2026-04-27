import { summarizeAndPersistEvalHistory } from '../core/runtime-centers-facade';
import type { PromptRegressionConfigSummary } from '../helpers/prompt-regression-summary';
import type { buildRuntimeCenter, buildRuntimeCenterSummary } from './runtime-runtime-center';
import { buildCompanyAgentsCenter } from './runtime-company-agents-center';
import { buildConnectorsCenter } from './runtime-connectors-center';
import type { buildRuntimeWorkspaceCenter } from '../core/runtime-centers-facade';
import { buildLearningCenter, buildLearningCenterSummary } from './runtime-learning-evidence-center';
import { buildSkillSourcesCenter } from './runtime-skill-sources-center';
import { buildToolsCenter } from '../tools/runtime-tools-center';

export type RuntimeCenterRecord = ReturnType<typeof buildRuntimeCenter> | ReturnType<typeof buildRuntimeCenterSummary>;
export type LearningCenterRecord =
  | Awaited<ReturnType<typeof buildLearningCenter>>
  | Awaited<ReturnType<typeof buildLearningCenterSummary>>;
export type EvalsCenterRecord = Awaited<ReturnType<typeof summarizeAndPersistEvalHistory>> & {
  promptRegression?: PromptRegressionConfigSummary;
};
export type ConnectorsCenterRecord = ReturnType<typeof buildConnectorsCenter>;
export type ToolsCenterRecord = ReturnType<typeof buildToolsCenter>;
export type CompanyAgentsCenterRecord = ReturnType<typeof buildCompanyAgentsCenter>;
export type SkillSourcesCenterRecord = ReturnType<typeof buildSkillSourcesCenter>;
export type WorkspaceCenterRecord = ReturnType<typeof buildRuntimeWorkspaceCenter>;
