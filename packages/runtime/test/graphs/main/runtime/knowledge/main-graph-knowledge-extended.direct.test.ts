import { describe, expect, it, vi } from 'vitest';

import {
  normalizeAgentError,
  inferAgentRoleFromMinistry,
  upsertFreshnessEvidence,
  recordAgentError
} from '../../../../../src/graphs/main/runtime/knowledge/main-graph-knowledge';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    runId: 'run-1',
    goal: 'test goal',
    context: undefined,
    externalSources: [],
    currentMinistry: 'gongbu-code',
    currentNode: 'execute',
    currentStep: 'execute',
    currentWorker: undefined,
    dispatches: [],
    ...overrides
  } as any;
}

describe('main-graph-knowledge extended (direct)', () => {
  describe('normalizeAgentError', () => {
    it('categorizes timeout errors as provider transient', () => {
      const result = normalizeAgentError(new Error('Request timeout'));
      expect(result.code).toBe('provider_transient_error');
      expect(result.category).toBe('provider');
      expect(result.retryable).toBe(true);
    });

    it('categorizes rate limit errors as provider transient', () => {
      const result = normalizeAgentError(new Error('Rate limit exceeded 429'));
      expect(result.code).toBe('provider_transient_error');
      expect(result.category).toBe('provider');
      expect(result.retryable).toBe(true);
    });

    it('categorizes 502/503/504 errors as provider transient', () => {
      expect(normalizeAgentError(new Error('502 Bad Gateway')).retryable).toBe(true);
      expect(normalizeAgentError(new Error('503 Service')).retryable).toBe(true);
      expect(normalizeAgentError(new Error('504 Gateway')).retryable).toBe(true);
    });

    it('categorizes approval errors', () => {
      const result = normalizeAgentError(new Error('approval flow blocked'));
      expect(result.code).toBe('approval_flow_error');
      expect(result.category).toBe('approval');
      expect(result.retryable).toBe(false);
    });

    it('categorizes tool errors', () => {
      const result = normalizeAgentError(new Error('tool execution failed'));
      expect(result.code).toBe('tool_execution_error');
      expect(result.category).toBe('tool');
    });

    it('categorizes connector errors as tool errors', () => {
      const result = normalizeAgentError(new Error('connector not available'));
      expect(result.category).toBe('tool');
    });

    it('categorizes capability errors as tool errors', () => {
      const result = normalizeAgentError(new Error('capability not found'));
      expect(result.category).toBe('tool');
    });

    it('categorizes sandbox errors as tool errors', () => {
      const result = normalizeAgentError(new Error('sandbox execution failed'));
      expect(result.category).toBe('tool');
      expect(result.retryable).toBe(false);
    });

    it('categorizes tool temporar errors as retryable', () => {
      const result = normalizeAgentError(new Error('tool temporary failure'));
      expect(result.retryable).toBe(true);
    });

    it('categorizes state errors', () => {
      const result = normalizeAgentError(new Error('state transition invalid'));
      expect(result.code).toBe('state_transition_error');
      expect(result.category).toBe('state');
      expect(result.retryable).toBe(false);
    });

    it('categorizes undefined errors as state errors', () => {
      const result = normalizeAgentError(new Error('value is undefined'));
      expect(result.category).toBe('state');
    });

    it('categorizes null errors as state errors', () => {
      const result = normalizeAgentError(new Error('value is null'));
      expect(result.category).toBe('state');
    });

    it('defaults to runtime error for unknown errors', () => {
      const result = normalizeAgentError(new Error('something weird'));
      expect(result.code).toBe('agent_runtime_error');
      expect(result.category).toBe('runtime');
      expect(result.retryable).toBe(false);
    });

    it('handles non-Error values', () => {
      const result = normalizeAgentError('string error');
      expect(result.name).toBe('UnknownError');
      expect(result.message).toBe('string error');
      expect(result.stack).toBeUndefined();
    });

    it('preserves stack from Error instances', () => {
      const error = new Error('test');
      const result = normalizeAgentError(error);
      expect(result.stack).toBeDefined();
    });

    it('handles null/undefined error values', () => {
      const result = normalizeAgentError(null);
      expect(result.message).toBe('null');
      expect(result.name).toBe('UnknownError');
    });
  });

  describe('inferAgentRoleFromMinistry', () => {
    it('returns reviewer for xingbu-review ministry', () => {
      expect(inferAgentRoleFromMinistry('xingbu-review')).toBe('reviewer');
    });

    it('returns research for hubu-search ministry', () => {
      expect(inferAgentRoleFromMinistry('hubu-search')).toBe('research');
    });

    it('returns research for libu-delivery ministry', () => {
      expect(inferAgentRoleFromMinistry('libu-delivery')).toBe('research');
    });

    it('returns research for libu-docs ministry', () => {
      expect(inferAgentRoleFromMinistry('libu-docs')).toBe('research');
    });

    it('defaults to executor for unknown ministry', () => {
      expect(inferAgentRoleFromMinistry('gongbu-code')).toBe('executor');
    });

    it('defaults to executor when ministry is undefined', () => {
      expect(inferAgentRoleFromMinistry(undefined)).toBe('executor');
    });

    it('infers reviewer from risk-compliance dispatch', () => {
      const dispatches = [{ specialistDomain: 'risk-compliance', selectedAgentId: 'agent-1' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('reviewer');
    });

    it('infers reviewer from reviewer agent id in dispatch', () => {
      const dispatches = [{ selectedAgentId: 'agent-reviewer-1' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('reviewer');
    });

    it('infers research from strategy dispatch', () => {
      const dispatches = [{ kind: 'strategy', selectedAgentId: 'agent-1' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('research');
    });

    it('infers research from strategy-counselor dispatch', () => {
      const dispatches = [{ selectionSource: 'strategy-counselor', selectedAgentId: 'agent-1' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('research');
    });

    it('infers executor from ministry dispatch', () => {
      const dispatches = [{ kind: 'ministry', selectedAgentId: 'agent-1' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('executor');
    });

    it('infers reviewer from requiredCapabilities containing risk-compliance', () => {
      const dispatches = [{ requiredCapabilities: ['specialist.risk-compliance'], selectedAgentId: 'agent-1' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('reviewer');
    });

    it('infers reviewer from agentId containing reviewer', () => {
      const dispatches = [{ agentId: 'the-reviewer-agent' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('reviewer');
    });

    it('skips fallback dispatches when finding latest resolved dispatch', () => {
      const dispatches = [
        { kind: 'fallback', selectedAgentId: 'fb-agent' },
        { kind: 'strategy', selectedAgentId: 'strat-agent' }
      ] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('research');
    });

    it('returns executor when dispatch has no selectedAgentId or agentId', () => {
      const dispatches = [{ kind: 'ministry' }] as any;
      expect(inferAgentRoleFromMinistry('gongbu-code', dispatches)).toBe('executor');
    });
  });

  describe('upsertFreshnessEvidence', () => {
    it('removes freshness_meta when not freshness sensitive', () => {
      const task = makeTask({
        externalSources: [
          { sourceType: 'freshness_meta', id: 'fm-1' },
          { sourceType: 'web', id: 'web-1' }
        ]
      });
      upsertFreshnessEvidence(task, false, undefined);
      expect(task.externalSources).toHaveLength(1);
      expect(task.externalSources[0].sourceType).toBe('web');
    });

    it('adds freshness_meta when freshness sensitive with sources', () => {
      const task = makeTask({
        externalSources: [
          { sourceType: 'web', trustClass: 'official' },
          { sourceType: 'document', trustClass: 'curated' }
        ]
      });
      upsertFreshnessEvidence(task, true, 'test summary');
      const freshnessMeta = task.externalSources.find((s: any) => s.sourceType === 'freshness_meta');
      expect(freshnessMeta).toBeDefined();
      expect(freshnessMeta.summary).toContain('test summary');
    });

    it('adds freshness_meta with no sources', () => {
      const task = makeTask({ externalSources: [] });
      upsertFreshnessEvidence(task, true, 'summary');
      expect(task.externalSources).toHaveLength(1);
      expect(task.externalSources[0].sourceType).toBe('freshness_meta');
    });

    it('handles undefined externalSources', () => {
      const task = makeTask({ externalSources: undefined });
      upsertFreshnessEvidence(task, false, undefined);
      expect(task.externalSources).toEqual([]);
    });

    it('handles missing sourceSummary', () => {
      const task = makeTask({ externalSources: [] });
      upsertFreshnessEvidence(task, true, undefined);
      expect(task.externalSources).toHaveLength(1);
      expect(task.externalSources[0].summary).toContain('信息基准日期');
    });

    it('uses createdAt when updatedAt is missing', () => {
      const task = makeTask({ externalSources: [], updatedAt: undefined, createdAt: '2026-01-01T00:00:00Z' });
      upsertFreshnessEvidence(task, true, 'test');
      expect(task.externalSources[0].detail.referenceTime).toBe('2026-01-01T00:00:00Z');
    });
  });

  describe('recordAgentError', () => {
    it('records error with trace and progress delta', () => {
      const task = makeTask();
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(task, new Error('test error'), { phase: 'task_pipeline' }, callbacks);
      expect(callbacks.addTrace).toHaveBeenCalledWith(
        task,
        'agent_error',
        expect.any(String),
        expect.objectContaining({ phase: 'task_pipeline' })
      );
      expect(callbacks.addProgressDelta).toHaveBeenCalled();
      expect(callbacks.upsertAgentState).toHaveBeenCalled();
    });

    it('uses currentWorker as boundary id when available', () => {
      const task = makeTask({ currentWorker: 'worker-1' });
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(task, new Error('test'), { phase: 'task_pipeline' }, callbacks);
      expect(callbacks.upsertAgentState).toHaveBeenCalledWith(task, expect.objectContaining({ agentId: 'worker-1' }));
    });

    it('uses dispatch agentId when no currentWorker', () => {
      const task = makeTask({
        currentWorker: undefined,
        dispatches: [{ selectedAgentId: 'dispatch-agent', kind: 'ministry' }]
      });
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(task, new Error('test'), { phase: 'task_pipeline' }, callbacks);
      expect(callbacks.upsertAgentState).toHaveBeenCalledWith(
        task,
        expect.objectContaining({ agentId: 'dispatch-agent' })
      );
    });

    it('falls back to agent-error-boundary when no ids available', () => {
      const task = makeTask({ currentWorker: undefined, currentMinistry: undefined, dispatches: [] });
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(task, new Error('test'), { phase: 'task_pipeline' }, callbacks);
      expect(callbacks.upsertAgentState).toHaveBeenCalledWith(
        task,
        expect.objectContaining({ agentId: 'agent-error-boundary' })
      );
    });

    it('includes mode and goal in trace data', () => {
      const task = makeTask();
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(
        task,
        new Error('test'),
        { phase: 'approval_recovery', mode: 'retry', goal: 'custom goal' },
        callbacks
      );
      expect(callbacks.addTrace).toHaveBeenCalledWith(
        task,
        'agent_error',
        expect.any(String),
        expect.objectContaining({ phase: 'approval_recovery', mode: 'retry', goal: 'custom goal' })
      );
    });

    it('handles non-Error values', () => {
      const task = makeTask();
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(task, 'string error', { phase: 'background_runner' }, callbacks);
      expect(callbacks.addTrace).toHaveBeenCalled();
    });

    it('includes toolName and intent in trace data', () => {
      const task = makeTask();
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(
        task,
        new Error('test'),
        { phase: 'task_pipeline', toolName: 'web_search', intent: 'execute' },
        callbacks
      );
      expect(callbacks.addTrace).toHaveBeenCalledWith(
        task,
        'agent_error',
        expect.any(String),
        expect.objectContaining({ toolName: 'web_search', intent: 'execute' })
      );
    });

    it('includes routeFlow in trace data', () => {
      const task = makeTask();
      const callbacks = {
        getMinistryLabel: vi.fn().mockReturnValue('工部'),
        addTrace: vi.fn(),
        addProgressDelta: vi.fn(),
        upsertAgentState: vi.fn()
      };
      recordAgentError(task, new Error('test'), { phase: 'task_pipeline', routeFlow: 'direct-reply' }, callbacks);
      expect(callbacks.addTrace).toHaveBeenCalledWith(
        task,
        'agent_error',
        expect.any(String),
        expect.objectContaining({ routeFlow: 'direct-reply' })
      );
    });
  });
});
