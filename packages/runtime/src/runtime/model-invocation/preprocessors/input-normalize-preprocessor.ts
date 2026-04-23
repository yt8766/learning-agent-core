import type { PreprocessDecision } from '@agent/core';

import type { ModelInvocationPreprocessor } from '../model-invocation.types';

export const inputNormalizePreprocessor: ModelInvocationPreprocessor = {
  name: 'input-normalize',
  run(decision): PreprocessDecision {
    return {
      ...decision,
      resolvedMessages: decision.resolvedMessages.map(message => ({
        ...message,
        content: message.content.trim()
      }))
    };
  }
};
