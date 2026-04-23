import {
  ModelInvocationRequestSchema,
  ModelInvocationResultSchema,
  type ModelInvocationRequest,
  type ModelInvocationResult,
  type PreprocessDecision
} from '@agent/core';

import { budgetEstimatePreprocessor } from './preprocessors/budget-estimate-preprocessor';
import { capabilityInjectionPreprocessor } from './preprocessors/capability-injection-preprocessor';
import { contextAssemblePreprocessor } from './preprocessors/context-assemble-preprocessor';
import { inputNormalizePreprocessor } from './preprocessors/input-normalize-preprocessor';
import { directReplyProfile } from './profiles/direct-reply-profile';
import { runtimeTaskProfile } from './profiles/runtime-task-profile';
import type {
  ModelInvocationPipeline,
  ModelInvocationPipelineOptions,
  ModelInvocationProfile,
  ModelInvocationProviderExecuteResult
} from './model-invocation.types';
import { buildModelInvocationTraceSummary as buildTraceSummary } from './model-invocation.types';

const DEFAULT_MODEL_ID = 'default-model';

const defaultProfiles = [directReplyProfile, runtimeTaskProfile];
const defaultPreprocessors = [
  inputNormalizePreprocessor,
  capabilityInjectionPreprocessor,
  contextAssemblePreprocessor,
  budgetEstimatePreprocessor
];

const createInitialDecision = (request: ModelInvocationRequest): PreprocessDecision => ({
  allowExecution: true,
  resolvedModelId: request.requestedModelId ?? request.budgetSnapshot.fallbackModelId ?? DEFAULT_MODEL_ID,
  resolvedMessages: request.messages,
  budgetDecision: {
    status: 'allow',
    estimatedInputTokens: 0
  },
  capabilityInjectionPlan: {
    selectedSkills: [],
    selectedTools: [],
    selectedMcpCapabilities: [],
    rejectedCandidates: [],
    reasons: [],
    riskFlags: []
  },
  cacheDecision: {
    status: 'bypass'
  },
  traceMeta: {
    stage: request.stage
  }
});

const createProfileMap = (profiles: ModelInvocationProfile[]): Map<string, ModelInvocationProfile> =>
  new Map(profiles.map(profile => [profile.id, profile]));

const mergeProfiles = (profiles?: ModelInvocationProfile[]): ModelInvocationProfile[] => {
  const profileMap = createProfileMap(defaultProfiles);

  for (const profile of profiles ?? []) {
    profileMap.set(profile.id, profile);
  }

  return Array.from(profileMap.values());
};

const mergePreprocessors = (
  preprocessors?: ModelInvocationPipelineOptions['preprocessors']
): NonNullable<ModelInvocationPipelineOptions['preprocessors']> => [...(preprocessors ?? []), ...defaultPreprocessors];

export class FixedModelInvocationPipeline implements ModelInvocationPipeline {
  private readonly profileMap: Map<string, ModelInvocationProfile>;
  private readonly preprocessors: NonNullable<ModelInvocationPipelineOptions['preprocessors']>;

  constructor(private readonly options: ModelInvocationPipelineOptions) {
    this.profileMap = createProfileMap(mergeProfiles(options.profiles));
    this.preprocessors = mergePreprocessors(options.preprocessors);
  }

  async invoke(rawRequest: ModelInvocationRequest): Promise<ModelInvocationResult> {
    const request = ModelInvocationRequestSchema.parse(rawRequest);
    const profile = this.resolveProfile(request);

    let decision = createInitialDecision(request);
    const context = { request, profile };

    for (const preprocessor of this.preprocessors) {
      decision = await preprocessor.run(decision, context);
    }

    if (!decision.allowExecution) {
      return ModelInvocationResultSchema.parse({
        finalOutput: {
          kind: 'text',
          text: decision.denyReason ?? 'Invocation denied'
        },
        invocationRecordId: request.invocationId,
        traceSummary: buildTraceSummary({
          request,
          decision,
          preprocessors: this.preprocessors.map(preprocessor => preprocessor.name),
          traceMeta: { denied: true }
        }),
        deliveryMeta: {}
      });
    }

    if (decision.cacheDecision.status === 'hit') {
      return ModelInvocationResultSchema.parse({
        finalOutput: {
          kind: 'text',
          text: decision.cacheDecision.cachedText
        },
        invocationRecordId: request.invocationId,
        traceSummary: buildTraceSummary({
          request,
          decision,
          preprocessors: this.preprocessors.map(preprocessor => preprocessor.name)
        }),
        deliveryMeta: {
          delivery: 'cache-hit',
          cacheKey: decision.cacheDecision.cacheKey
        }
      });
    }

    const providerResult = await this.options.provider.execute({
      request,
      decision,
      profile,
      modelId: decision.resolvedModelId,
      messages: decision.resolvedMessages
    });

    return this.toResult(request, decision, providerResult);
  }

  private resolveProfile(request: ModelInvocationRequest): ModelInvocationProfile {
    return this.profileMap.get(request.modeProfile) ?? runtimeTaskProfile;
  }

  private toResult(
    request: ModelInvocationRequest,
    decision: PreprocessDecision,
    providerResult: ModelInvocationProviderExecuteResult
  ): ModelInvocationResult {
    return ModelInvocationResultSchema.parse({
      finalOutput: {
        kind: 'text',
        text: providerResult.outputText
      },
      invocationRecordId: request.invocationId,
      taskUsageSnapshot: providerResult.usage,
      traceSummary: buildTraceSummary({
        request,
        decision,
        providerId: providerResult.providerId,
        preprocessors: this.preprocessors.map(preprocessor => preprocessor.name)
      }),
      deliveryMeta: providerResult.deliveryMeta ?? {}
    });
  }
}
