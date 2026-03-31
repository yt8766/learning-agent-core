import type { PolicyConfig, RuntimeProfile, RuntimeSettingsOverrides } from './settings.types';

export const DEFAULT_DATA_PATHS = {
  memoryFilePath: 'data/memory/records.jsonl',
  rulesFilePath: 'data/rules/rules.jsonl',
  tasksStateFilePath: 'data/runtime/tasks-state.json',
  semanticCacheFilePath: 'data/runtime/semantic-cache.json',
  skillsRoot: 'data/skills',
  pluginsLabRoot: 'data/skills/plugins-lab',
  skillSourcesRoot: 'data/skills/remote-sources',
  skillPackagesRoot: 'data/skills/installed',
  skillReceiptsRoot: 'data/skills/receipts',
  skillInternalRoot: 'data/skills/installed/internal',
  registryFilePath: 'data/skills/registry.json',
  knowledgeRoot: 'data/knowledge'
} as const;

export function buildProfileOverrides(profile: RuntimeProfile): RuntimeSettingsOverrides {
  switch (profile) {
    case 'company':
      return {
        memoryFilePath: 'data/agent-work/memory/records.jsonl',
        rulesFilePath: 'data/agent-work/rules/rules.jsonl',
        tasksStateFilePath: 'data/agent-work/runtime/tasks-state.json',
        semanticCacheFilePath: 'data/agent-work/runtime/semantic-cache.json',
        skillsRoot: 'data/agent-work/skills',
        pluginsLabRoot: 'data/agent-work/skills/plugins-lab',
        skillSourcesRoot: 'data/agent-work/skills/remote-sources',
        skillPackagesRoot: 'data/agent-work/skills/installed',
        skillReceiptsRoot: 'data/agent-work/skills/receipts',
        skillInternalRoot: 'data/agent-work/skills/installed/internal',
        registryFilePath: 'data/agent-work/skills/registry.json',
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
            fallbackModelId: 'glm-4.7-flash'
          }
        }
      };
    case 'personal':
      return {
        memoryFilePath: 'data/agent-personal/memory/records.jsonl',
        rulesFilePath: 'data/agent-personal/rules/rules.jsonl',
        tasksStateFilePath: 'data/agent-personal/runtime/tasks-state.json',
        semanticCacheFilePath: 'data/agent-personal/runtime/semantic-cache.json',
        skillsRoot: 'data/agent-personal/skills',
        pluginsLabRoot: 'data/agent-personal/skills/plugins-lab',
        skillSourcesRoot: 'data/agent-personal/skills/remote-sources',
        skillPackagesRoot: 'data/agent-personal/skills/installed',
        skillReceiptsRoot: 'data/agent-personal/skills/receipts',
        skillInternalRoot: 'data/agent-personal/skills/installed/internal',
        registryFilePath: 'data/agent-personal/skills/registry.json',
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
            fallbackModelId: 'glm-4.7-flash'
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
            fallbackModelId: 'glm-4.7-flash'
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
            fallbackModelId: 'glm-4.7-flash'
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
      fallbackModelId:
        overridePolicy?.budget?.fallbackModelId ?? profilePolicy?.budget?.fallbackModelId ?? 'glm-4.7-flash'
    }
  };
}
