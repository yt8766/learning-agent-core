import type { RuntimeProfile, RuntimeSettingsOverrides } from '../schemas/settings.types';

export function buildProfileOverrides(profile: RuntimeProfile): RuntimeSettingsOverrides {
  switch (profile) {
    case 'company':
      return {
        memoryFilePath: 'profile-storage/company/memory/records.jsonl',
        rulesFilePath: 'profile-storage/company/rules/rules.jsonl',
        vectorIndexFilePath: 'profile-storage/company/memory/vector-index.json',
        tasksStateFilePath: 'profile-storage/company/runtime/tasks-state.json',
        semanticCacheFilePath: 'profile-storage/company/runtime/semantic-cache.json',
        skillsRoot: 'profile-storage/company/skills',
        pluginsLabRoot: 'profile-storage/company/skills/plugins-lab',
        skillSourcesRoot: 'profile-storage/company/skills/remote-sources',
        skillPackagesRoot: 'profile-storage/company/skills/installed',
        skillReceiptsRoot: 'profile-storage/company/skills/receipts',
        skillInternalRoot: 'profile-storage/company/skills/installed/internal',
        registryFilePath: 'profile-storage/company/skills/registry.json',
        knowledgeRoot: 'profile-storage/company/knowledge',
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
        memoryFilePath: 'profile-storage/personal/memory/records.jsonl',
        rulesFilePath: 'profile-storage/personal/rules/rules.jsonl',
        vectorIndexFilePath: 'profile-storage/personal/memory/vector-index.json',
        tasksStateFilePath: 'profile-storage/personal/runtime/tasks-state.json',
        semanticCacheFilePath: 'profile-storage/personal/runtime/semantic-cache.json',
        skillsRoot: 'profile-storage/personal/skills',
        pluginsLabRoot: 'profile-storage/personal/skills/plugins-lab',
        skillSourcesRoot: 'profile-storage/personal/skills/remote-sources',
        skillPackagesRoot: 'profile-storage/personal/skills/installed',
        skillReceiptsRoot: 'profile-storage/personal/skills/receipts',
        skillInternalRoot: 'profile-storage/personal/skills/installed/internal',
        registryFilePath: 'profile-storage/personal/skills/registry.json',
        knowledgeRoot: 'profile-storage/personal/knowledge',
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
