import type { PreprocessDecision } from '@agent/core';

import { mergeSystemMessages } from '../../../utils/system-messages';
import type { ModelInvocationPreprocessor } from '../model-invocation.types';

export const contextAssemblePreprocessor: ModelInvocationPreprocessor = {
  name: 'context-assemble',
  run(decision, context): PreprocessDecision {
    return {
      ...decision,
      resolvedMessages: mergeSystemMessages([
        ...context.profile.buildSystemMessages(context.request),
        ...decision.resolvedMessages
      ])
    };
  }
};
