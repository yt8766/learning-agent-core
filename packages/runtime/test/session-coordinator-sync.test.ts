import { describe, expect, it, vi } from 'vitest';

import { buildCheckpointCognitionSnapshot } from '../src/session/coordinator/session-coordinator-sync';

describe('session-coordinator-sync', () => {
  describe('buildCheckpointCognitionSnapshot', () => {
    it('returns undefined when no thoughtChain and no thinkState', () => {
      const checkpoint = {} as any;
      expect(buildCheckpointCognitionSnapshot(checkpoint)).toBeUndefined();
    });

    it('returns undefined when thoughtChain is empty and no thinkState', () => {
      const checkpoint = { thoughtChain: [] } as any;
      expect(buildCheckpointCognitionSnapshot(checkpoint)).toBeUndefined();
    });

    it('returns snapshot with thoughtChain when present', () => {
      const checkpoint = {
        thoughtChain: [{ id: 't1', title: 'thinking' }]
      } as any;
      const result = buildCheckpointCognitionSnapshot(checkpoint);
      expect(result).toBeDefined();
      expect(result!.thoughtChain).toEqual([{ id: 't1', title: 'thinking' }]);
      expect(result!.capturedAt).toBeDefined();
    });

    it('returns snapshot with thinkState when present', () => {
      const checkpoint = {
        thinkState: { thinkingDurationMs: 1000, loading: true, blink: true }
      } as any;
      const result = buildCheckpointCognitionSnapshot(checkpoint);
      expect(result).toBeDefined();
      expect(result!.thinkState!.loading).toBe(false);
      expect(result!.thinkState!.blink).toBe(false);
      expect(result!.thinkState!.thinkingDurationMs).toBe(1000);
    });

    it('returns snapshot with both thoughtChain and thinkState', () => {
      const checkpoint = {
        thoughtChain: [{ id: 't1' }],
        thinkState: { thinkingDurationMs: 500 }
      } as any;
      const result = buildCheckpointCognitionSnapshot(checkpoint);
      expect(result).toBeDefined();
      expect(result!.thoughtChain.length).toBe(1);
      expect(result!.thinkState).toBeDefined();
    });

    it('deep clones thoughtChain to avoid mutation', () => {
      const chain = [{ id: 't1' }];
      const checkpoint = { thoughtChain: chain } as any;
      const result = buildCheckpointCognitionSnapshot(checkpoint);
      chain[0].id = 'mutated';
      expect(result!.thoughtChain[0].id).toBe('t1');
    });
  });
});
