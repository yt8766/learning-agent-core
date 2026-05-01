import type { SkillCard, SkillInstallReceipt, SkillManifestRecord, SkillSourceRecord } from '@agent/core';

import type { RuntimeSkillInstallContext } from './skills/runtime-skill-install.service';
import { searchLocalSkillSuggestions, type RuntimeSkillSourcesContext } from './skills/runtime-skill-sources.service';
import type { RuntimeHost } from './core/runtime.host';
export { createSkillInstallContext, createSkillSourcesContext } from './domain/skills/runtime-skill-contexts';
export {
  completeRemoteSkillInstall,
  completeSkillInstall,
  persistSkillInstallReceipt,
  resolvePreExecutionSkillIntervention,
  resolveRuntimeSkillIntervention,
  resolveSkillInstallApproval,
  syncInstalledSkillWorkers,
  type RuntimeSkillSearchPayload,
  type RuntimeSkillSuggestion
} from './domain/skills/runtime-skill-orchestration';

type RuntimeSkillSourcesContextWithList = RuntimeSkillSourcesContext & {
  listSkillSources?: () => Promise<SkillSourceRecord[]>;
};

export const KNOWLEDGE_METHOD_NAMES = [
  'searchMemory',
  'getMemory',
  'invalidateMemory',
  'supersedeMemory',
  'restoreMemory',
  'retireMemory',
  'ingestKnowledgeSources',
  'ingestUserUploadSource',
  'ingestCatalogSyncSources',
  'ingestWebCuratedSources',
  'ingestConnectorSyncSources',
  'listRules',
  'invalidateRule',
  'supersedeRule',
  'restoreRule',
  'retireRule'
] as const;

export const SKILL_CATALOG_METHOD_NAMES = [
  'listSkills',
  'listLabSkills',
  'getSkill',
  'promoteSkill',
  'disableSkill',
  'restoreSkill',
  'retireSkill'
] as const;

export const TASK_METHOD_NAMES = [
  'describeGraph',
  'createTask',
  'createAgentDiagnosisTask',
  'listTasks',
  'listPendingApprovals',
  'getTask',
  'listTaskTraces',
  'getTaskAudit',
  'listTaskAgents',
  'listTaskMessages',
  'getTaskPlan',
  'getTaskLocalSkillSuggestions',
  'getTaskReview',
  'retryTask',
  'approveTaskAction',
  'rejectTaskAction',
  'createDocumentLearningJob',
  'createResearchLearningJob',
  'getLearningJob'
] as const;

export const CENTER_METHOD_NAMES = [
  'getRuntimeCenter',
  'getApprovalsCenter',
  'getLearningCenter',
  'getEvidenceCenter',
  'getConnectorsCenter',
  'getBrowserReplay',
  'getSkillSourcesCenter',
  'syncSkillSource',
  'installSkill',
  'approveSkillInstall',
  'rejectSkillInstall',
  'setSkillSourceEnabled',
  'getCompanyAgentsCenter',
  'setCompanyAgentEnabled',
  'setConnectorEnabled',
  'setConnectorApprovalPolicy',
  'clearConnectorApprovalPolicy',
  'setCapabilityApprovalPolicy',
  'clearCapabilityApprovalPolicy',
  'closeConnectorSession',
  'refreshConnectorDiscovery',
  'refreshMetricsSnapshots',
  'configureConnector',
  'getEvalsCenter',
  'getPlatformConsole',
  'exportRuntimeCenter',
  'exportApprovalsCenter',
  'exportEvalsCenter'
] as const;

export const SESSION_METHOD_NAMES = [
  'listSessions',
  'createSession',
  'deleteSession',
  'updateSession',
  'getSession',
  'listSessionMessages',
  'listSessionEvents',
  'getSessionCheckpoint',
  'appendSessionMessage',
  'approveSessionAction',
  'rejectSessionAction',
  'confirmLearning',
  'recoverSession',
  'recoverSessionToCheckpoint',
  'cancelSession',
  'subscribeSession'
] as const;

export function bindServiceMethods<TTarget extends object, TSource extends object>(
  target: TTarget,
  source: TSource,
  methodNames: readonly (keyof TSource & string)[]
) {
  for (const methodName of methodNames) {
    const method = source[methodName];
    if (typeof method !== 'function') {
      continue;
    }
    Object.defineProperty(target, methodName, {
      value: method.bind(source),
      configurable: true,
      writable: true
    });
  }
}

export function resolveTaskSkillSuggestions(
  getSkillSourcesContext: () => RuntimeSkillSourcesContextWithList,
  goal: string,
  options?: { usedInstalledSkills?: string[]; limit?: number }
) {
  return searchLocalSkillSuggestions(getSkillSourcesContext(), goal, options);
}
