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
            maxCostPerTaskUsd: 2
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
            maxCostPerTaskUsd: 1
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
            maxCostPerTaskUsd: 1.5
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
            maxCostPerTaskUsd: 2
          }
        }
      };
  }
}
