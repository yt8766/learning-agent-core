import type { ModelInvocationRequest } from '@agent/core';

import type { ModelInvocationProfile } from '../model-invocation.types';

export const runtimeTaskProfile: ModelInvocationProfile = {
  id: 'runtime-task',
  buildSystemMessages(_request: ModelInvocationRequest) {
    return [{ role: 'system', content: 'profile:runtime-task' }];
  }
};
