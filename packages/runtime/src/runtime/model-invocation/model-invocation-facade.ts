import type { ModelInvocationRequest, ModelInvocationResult } from '@agent/core';

import { FixedModelInvocationPipeline } from './model-invocation-pipeline';
import type { ModelInvocationFacadeOptions } from './model-invocation.types';

export class ModelInvocationFacade {
  private readonly pipeline: FixedModelInvocationPipeline;

  constructor(options: ModelInvocationFacadeOptions) {
    this.pipeline = new FixedModelInvocationPipeline(options);
  }

  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
    return this.pipeline.invoke(request);
  }
}
