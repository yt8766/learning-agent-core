import { describe, expect, it } from 'vitest';

import {
  resolveInterruptPayloadField,
  resolveLocalSkillSuggestionsWithTimeout,
  resolveTaskExecutionMode,
  resolveTaskInteractionKind
} from '../../src/runtime-observability/runtime-observability-filters';

describe('runtime observability filters', () => {
  it('resolves execution mode, interaction kind, and interrupt payload fields from persisted task projections', () => {
    expect(
      resolveTaskExecutionMode({
        executionPlan: { mode: 'planning-readonly' }
      } as any)
    ).toBe('plan');

    expect(
      resolveTaskInteractionKind({
        activeInterrupt: {
          kind: 'user-input',
          payload: {}
        }
      } as any)
    ).toBe('plan-question');

    expect(
      resolveInterruptPayloadField(
        {
          payload: {
            riskReason: 'destructive'
          }
        } as any,
        'riskReason'
      )
    ).toBe('destructive');
  });

  it('falls back to timeout result when local skill suggestion resolution rejects', async () => {
    await expect(resolveLocalSkillSuggestionsWithTimeout(async () => Promise.reject(new Error('timeout')))).resolves.toEqual(
      expect.objectContaining({
        suggestions: [],
        gapSummary: 'local-skill-suggestions-timeout'
      })
    );
  });
});
