import { describe, expect, it } from 'vitest';
import { AgentRuntimeProfileSchema } from '@agent/core';
import {
  defaultAgentRuntimeProfiles,
  resolveDefaultAgentRuntimeProfile
} from '../src/agentos/default-agent-runtime-profiles';

describe('defaultAgentRuntimeProfiles', () => {
  it('contains valid supervisor, coder, reviewer, and data-report profiles', () => {
    for (const profile of defaultAgentRuntimeProfiles) {
      expect(() => AgentRuntimeProfileSchema.parse(profile)).not.toThrow();
    }

    expect(defaultAgentRuntimeProfiles.map(profile => profile.descriptor.agentId)).toEqual([
      'supervisor',
      'coder',
      'reviewer',
      'data-report'
    ]);
  });

  it('resolves a default profile by agent id', () => {
    const profile = resolveDefaultAgentRuntimeProfile('coder');

    expect(profile?.descriptor.role).toBe('coder');
    expect(profile?.syscall.mutation).toContain('apply_patch');
  });

  it('protects exported defaults from consumer mutation', () => {
    expect(() => defaultAgentRuntimeProfiles.push(defaultAgentRuntimeProfiles[0])).toThrow(TypeError);
    expect(() => {
      defaultAgentRuntimeProfiles[0].observability.audit = false;
    }).toThrow(TypeError);
  });

  it('returns cloned resolved profiles so consumers cannot mutate global defaults', () => {
    const firstCoder = resolveDefaultAgentRuntimeProfile('coder');
    const secondCoder = resolveDefaultAgentRuntimeProfile('coder');

    expect(firstCoder).not.toBe(secondCoder);

    firstCoder?.syscall.mutation.push('unsafe_mutation');
    firstCoder!.observability.audit = false;

    expect(secondCoder?.syscall.mutation).toEqual(['apply_patch']);
    expect(resolveDefaultAgentRuntimeProfile('coder')?.observability.audit).toBe(true);
  });
});
