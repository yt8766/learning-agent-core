import { describe, expect, it } from 'vitest';

import {
  CapabilityInjectionPlanSchema,
  ModelInvocationRequestSchema,
  ModelInvocationResultSchema,
  PreprocessDecisionSchema
} from '../../src/runtime-invocation';

describe('@agent/core runtime invocation contracts', () => {
  it('applies key defaults for request and capability plans', () => {
    const plan = CapabilityInjectionPlanSchema.parse({});
    const request = ModelInvocationRequestSchema.parse({
      invocationId: 'invocation-1',
      modeProfile: 'direct-reply',
      stage: 'preprocess',
      messages: [{ role: 'user', content: '请帮我总结这次变更' }],
      budgetSnapshot: {}
    });

    expect(plan).toEqual({
      selectedSkills: [],
      selectedTools: [],
      selectedMcpCapabilities: [],
      rejectedCandidates: [],
      reasons: [],
      riskFlags: []
    });
    expect(request.contextHints).toEqual({});
    expect(request.capabilityHints).toEqual({});
    expect(request.traceContext).toEqual({});
  });

  it('parses a model invocation request contract', () => {
    const request = ModelInvocationRequestSchema.parse({
      invocationId: 'invocation-1',
      modeProfile: 'direct-reply',
      stage: 'preprocess',
      messages: [{ role: 'user', content: '请帮我总结这次变更' }],
      budgetSnapshot: {
        costConsumedCny: 9.11
      },
      contextHints: {},
      capabilityHints: {},
      traceContext: {}
    });

    expect(request.invocationId).toBe('invocation-1');
    expect(request.messages[0]?.role).toBe('user');
    expect(request.budgetSnapshot.costConsumedCny).toBe(9.11);
  });

  it('parses a preprocess decision contract', () => {
    const decision = PreprocessDecisionSchema.parse({
      allowExecution: true,
      resolvedModelId: 'gpt-5.4',
      resolvedMessages: [{ role: 'system', content: '你是一个可靠的助手。' }],
      budgetDecision: {
        status: 'allow',
        estimatedInputTokens: 128
      },
      capabilityInjectionPlan: {
        selectedSkills: ['runtime-observability'],
        selectedTools: ['search'],
        selectedMcpCapabilities: [],
        rejectedCandidates: [],
        reasons: [],
        riskFlags: []
      },
      cacheDecision: {
        status: 'miss'
      },
      traceMeta: {}
    });

    expect(decision.allowExecution).toBe(true);
    expect(decision.capabilityInjectionPlan.selectedSkills).toContain('runtime-observability');
  });

  it('rejects preprocess decisions that disable execution without a deny reason', () => {
    expect(
      PreprocessDecisionSchema.safeParse({
        allowExecution: false,
        resolvedModelId: 'gpt-5.4',
        resolvedMessages: [{ role: 'system', content: '你是一个可靠的助手。' }],
        budgetDecision: {
          status: 'allow',
          estimatedInputTokens: 128
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
          status: 'miss'
        },
        traceMeta: {}
      }).success
    ).toBe(false);
  });

  it('rejects fallback budget decisions without a fallback model id', () => {
    expect(
      PreprocessDecisionSchema.safeParse({
        allowExecution: true,
        resolvedModelId: 'gpt-5.4',
        resolvedMessages: [{ role: 'system', content: '你是一个可靠的助手。' }],
        budgetDecision: {
          status: 'fallback',
          estimatedInputTokens: 128
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
          status: 'miss'
        },
        traceMeta: {}
      }).success
    ).toBe(false);
  });

  it('rejects cache hits without cache metadata', () => {
    expect(
      PreprocessDecisionSchema.safeParse({
        allowExecution: true,
        resolvedModelId: 'gpt-5.4',
        resolvedMessages: [{ role: 'system', content: '你是一个可靠的助手。' }],
        budgetDecision: {
          status: 'allow',
          estimatedInputTokens: 128
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
          status: 'hit'
        },
        traceMeta: {}
      }).success
    ).toBe(false);
  });

  it('parses a model invocation result contract', () => {
    const result = ModelInvocationResultSchema.parse({
      finalOutput: {
        kind: 'text',
        text: '变更已完成。'
      },
      invocationRecordId: 'record-1',
      traceSummary: {},
      deliveryMeta: {}
    });

    expect(result.finalOutput.kind).toBe('text');
    expect(result.invocationRecordId).toBe('record-1');
  });

  it('rejects text outputs that omit the text field', () => {
    expect(
      ModelInvocationResultSchema.safeParse({
        finalOutput: {
          kind: 'text'
        },
        invocationRecordId: 'record-1',
        traceSummary: {},
        deliveryMeta: {}
      }).success
    ).toBe(false);
  });

  it('rejects object outputs that omit the object field', () => {
    expect(
      ModelInvocationResultSchema.safeParse({
        finalOutput: {
          kind: 'object'
        },
        invocationRecordId: 'record-1',
        traceSummary: {},
        deliveryMeta: {}
      }).success
    ).toBe(false);
  });
});
