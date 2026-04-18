import type { RuntimeProfile, RuntimeSettingsOverrides } from '../schemas/settings.types';

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
