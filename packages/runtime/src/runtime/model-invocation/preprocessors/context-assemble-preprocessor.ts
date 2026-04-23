import type { PreprocessDecision } from '@agent/core';

import type { ModelInvocationPreprocessor } from '../model-invocation.types';

export const contextAssemblePreprocessor: ModelInvocationPreprocessor = {
  name: 'context-assemble',
  run(decision, context): PreprocessDecision {
    return {
      ...decision,
      resolvedMessages: [...context.profile.buildSystemMessages(context.request), ...decision.resolvedMessages]
    };
  }
};
