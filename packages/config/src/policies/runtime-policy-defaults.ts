import type { BudgetPolicy, PolicyConfig } from '../schemas/settings.types';

type PartialPolicyInput = Partial<Omit<PolicyConfig, 'budget'>> & { budget?: Partial<BudgetPolicy> };

export function mergeNormalizedPolicy(
  profilePolicy: PartialPolicyInput | undefined,
  overridePolicy: PartialPolicyInput | undefined
): PartialPolicyInput {
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
      ...(overridePolicy?.budget?.fallbackModelId || profilePolicy?.budget?.fallbackModelId
        ? { fallbackModelId: overridePolicy?.budget?.fallbackModelId ?? profilePolicy?.budget?.fallbackModelId }
        : {})
    } as BudgetPolicy
  };
}
