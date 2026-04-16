import type { PolicyConfig, RuntimeProfile, RuntimeSettingsOverrides } from './settings.types';

export const DEFAULT_DATA_PATHS = {
  memoryFilePath: 'data/memory/records.jsonl',
  rulesFilePath: 'data/rules/rules.jsonl',
  vectorIndexFilePath: 'data/memory/vector-index.json',
  tasksStateFilePath: 'data/runtime/tasks-state.json',
  semanticCacheFilePath: 'data/runtime/semantic-cache.json',
  skillsRoot: 'data/skill-runtime',
  pluginsLabRoot: 'data/skill-runtime/plugins-lab',
  skillSourcesRoot: 'data/skill-runtime/remote-sources',
  skillPackagesRoot: 'data/skill-runtime/installed',
  skillReceiptsRoot: 'data/skill-runtime/receipts',
  skillInternalRoot: 'data/skill-runtime/installed/internal',
  registryFilePath: 'data/skill-runtime/registry.json',
  knowledgeRoot: 'data/knowledge'
} as const;

export function buildProfileOverrides(profile: RuntimeProfile): RuntimeSettingsOverrides {
  switch (profile) {
    case 'company':
      return {
        memoryFilePath: 'data/agent-work/memory/records.jsonl',
        rulesFilePath: 'data/agent-work/rules/rules.jsonl',
        vectorIndexFilePath: 'data/agent-work/memory/vector-index.json',
        tasksStateFilePath: 'data/agent-work/runtime/tasks-state.json',
        semanticCacheFilePath: 'data/agent-work/runtime/semantic-cache.json',
        skillsRoot: 'data/agent-work/skill-runtime',
        pluginsLabRoot: 'data/agent-work/skill-runtime/plugins-lab',
        skillSourcesRoot: 'data/agent-work/skill-runtime/remote-sources',
        skillPackagesRoot: 'data/agent-work/skill-runtime/installed',
        skillReceiptsRoot: 'data/agent-work/skill-runtime/receipts',
        skillInternalRoot: 'data/agent-work/skill-runtime/installed/internal',
        registryFilePath: 'data/agent-work/skill-runtime/registry.json',
        knowledgeRoot: 'data/agent-work/knowledge',
        policy: {
          approvalMode: 'strict',
          skillInstallMode: 'manual',
          learningMode: 'controlled',
          sourcePolicyMode: 'internal-only',
          memoryPolicy: {
            localFirst: true
          },
          learningPolicy: {
            autoLearnPreferences: true,
            autoLearnHeuristics: false,
            autoLearnTaskExperience: false,
            requireConfirmationOnConflict: true
          },
          approvalPolicy: {
            safeWriteAutoApprove: false,
            destructiveActionRequireApproval: true
          },
          suggestionPolicy: {
            expertAdviceDefault: true,
            autoSearchSkillsOnGap: true
          },
          budget: {
            stepBudget: 8,
            retryBudget: 1,
            sourceBudget: 6,
            maxCostPerTaskUsd: 2,
            fallbackModelId: 'glm-5.1'
          }
        }
      };
    case 'personal':
      return {
        memoryFilePath: 'data/agent-personal/memory/records.jsonl',
        rulesFilePath: 'data/agent-personal/rules/rules.jsonl',
        vectorIndexFilePath: 'data/agent-personal/memory/vector-index.json',
        tasksStateFilePath: 'data/agent-personal/runtime/tasks-state.json',
        semanticCacheFilePath: 'data/agent-personal/runtime/semantic-cache.json',
        skillsRoot: 'data/agent-personal/skill-runtime',
        pluginsLabRoot: 'data/agent-personal/skill-runtime/plugins-lab',
        skillSourcesRoot: 'data/agent-personal/skill-runtime/remote-sources',
        skillPackagesRoot: 'data/agent-personal/skill-runtime/installed',
        skillReceiptsRoot: 'data/agent-personal/skill-runtime/receipts',
        skillInternalRoot: 'data/agent-personal/skill-runtime/installed/internal',
        registryFilePath: 'data/agent-personal/skill-runtime/registry.json',
        knowledgeRoot: 'data/agent-personal/knowledge',
        policy: {
          approvalMode: 'auto',
          skillInstallMode: 'low-risk-auto',
          learningMode: 'aggressive',
          sourcePolicyMode: 'open-web-allowed',
          memoryPolicy: {
            localFirst: true
          },
          learningPolicy: {
            autoLearnPreferences: true,
            autoLearnHeuristics: true,
            autoLearnTaskExperience: true,
            requireConfirmationOnConflict: true
          },
          approvalPolicy: {
            safeWriteAutoApprove: true,
            destructiveActionRequireApproval: true
          },
          suggestionPolicy: {
            expertAdviceDefault: true,
            autoSearchSkillsOnGap: true
          },
          budget: {
            stepBudget: 12,
            retryBudget: 2,
            sourceBudget: 12,
            maxCostPerTaskUsd: 1,
            fallbackModelId: 'glm-5.1'
          }
        }
      };
    case 'cli':
      return {
        policy: {
          approvalMode: 'balanced',
          skillInstallMode: 'manual',
          learningMode: 'controlled',
          sourcePolicyMode: 'controlled-first',
          memoryPolicy: {
            localFirst: true
          },
          learningPolicy: {
            autoLearnPreferences: true,
            autoLearnHeuristics: false,
            autoLearnTaskExperience: false,
            requireConfirmationOnConflict: true
          },
          approvalPolicy: {
            safeWriteAutoApprove: true,
            destructiveActionRequireApproval: true
          },
          suggestionPolicy: {
            expertAdviceDefault: true,
            autoSearchSkillsOnGap: true
          },
          budget: {
            stepBudget: 6,
            retryBudget: 1,
            sourceBudget: 4,
            maxCostPerTaskUsd: 1.5,
            fallbackModelId: 'glm-5.1'
          }
        }
      };
    case 'platform':
    default:
      return {
        policy: {
          approvalMode: 'balanced',
          skillInstallMode: 'manual',
          learningMode: 'controlled',
          sourcePolicyMode: 'controlled-first',
          memoryPolicy: {
            localFirst: true
          },
          learningPolicy: {
            autoLearnPreferences: true,
            autoLearnHeuristics: true,
            autoLearnTaskExperience: false,
            requireConfirmationOnConflict: true
          },
          approvalPolicy: {
            safeWriteAutoApprove: true,
            destructiveActionRequireApproval: true
          },
          suggestionPolicy: {
            expertAdviceDefault: true,
            autoSearchSkillsOnGap: true
          },
          budget: {
            stepBudget: 8,
            retryBudget: 1,
            sourceBudget: 8,
            maxCostPerTaskUsd: 2,
            fallbackModelId: 'glm-5.1'
          }
        }
      };
  }
}

export function mergeNormalizedPolicy(
  profilePolicy: Partial<PolicyConfig> | undefined,
  overridePolicy: Partial<PolicyConfig> | undefined
): Partial<PolicyConfig> {
  return {
    ...profilePolicy,
    ...overridePolicy,
    memoryPolicy: {
      localFirst: overridePolicy?.memoryPolicy?.localFirst ?? profilePolicy?.memoryPolicy?.localFirst ?? true
    },
    learningPolicy: {
      autoLearnPreferences:
        overridePolicy?.learningPolicy?.autoLearnPreferences ??
        profilePolicy?.learningPolicy?.autoLearnPreferences ??
        true,
      autoLearnHeuristics:
        overridePolicy?.learningPolicy?.autoLearnHeuristics ??
        profilePolicy?.learningPolicy?.autoLearnHeuristics ??
        false,
      autoLearnTaskExperience:
        overridePolicy?.learningPolicy?.autoLearnTaskExperience ??
        profilePolicy?.learningPolicy?.autoLearnTaskExperience ??
        false,
      requireConfirmationOnConflict:
        overridePolicy?.learningPolicy?.requireConfirmationOnConflict ??
        profilePolicy?.learningPolicy?.requireConfirmationOnConflict ??
        true
    },
    approvalPolicy: {
      safeWriteAutoApprove:
        overridePolicy?.approvalPolicy?.safeWriteAutoApprove ??
        profilePolicy?.approvalPolicy?.safeWriteAutoApprove ??
        false,
      destructiveActionRequireApproval:
        overridePolicy?.approvalPolicy?.destructiveActionRequireApproval ??
        profilePolicy?.approvalPolicy?.destructiveActionRequireApproval ??
        true
    },
    suggestionPolicy: {
      expertAdviceDefault:
        overridePolicy?.suggestionPolicy?.expertAdviceDefault ??
        profilePolicy?.suggestionPolicy?.expertAdviceDefault ??
        true,
      autoSearchSkillsOnGap:
        overridePolicy?.suggestionPolicy?.autoSearchSkillsOnGap ??
        profilePolicy?.suggestionPolicy?.autoSearchSkillsOnGap ??
        true
    },
    budget: {
      stepBudget: overridePolicy?.budget?.stepBudget ?? profilePolicy?.budget?.stepBudget ?? 8,
      retryBudget: overridePolicy?.budget?.retryBudget ?? profilePolicy?.budget?.retryBudget ?? 1,
      sourceBudget: overridePolicy?.budget?.sourceBudget ?? profilePolicy?.budget?.sourceBudget ?? 8,
      maxCostPerTaskUsd: overridePolicy?.budget?.maxCostPerTaskUsd ?? profilePolicy?.budget?.maxCostPerTaskUsd ?? 2,
      fallbackModelId: overridePolicy?.budget?.fallbackModelId ?? profilePolicy?.budget?.fallbackModelId ?? 'glm-5.1'
    }
  };
}
