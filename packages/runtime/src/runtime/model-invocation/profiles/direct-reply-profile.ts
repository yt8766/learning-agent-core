import type { ModelInvocationRequest } from '@agent/core';

import type { ModelInvocationProfile } from '../model-invocation.types';

export const directReplyProfile: ModelInvocationProfile = {
  id: 'direct-reply',
  buildSystemMessages(_request: ModelInvocationRequest) {
    return [];
  }
};
