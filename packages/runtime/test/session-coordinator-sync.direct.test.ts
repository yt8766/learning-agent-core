import { describe, expect, it } from 'vitest';

import { buildCheckpointCognitionSnapshot } from '../src/session/coordinator/session-coordinator-sync';

describe('session-coordinator-sync (direct)', () => {
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
      const chain = [{ key: 'k1', kind: 'reasoning', title: 'test', status: 'success' }];
      const checkpoint = { thoughtChain: chain } as any;
      const snapshot = buildCheckpointCognitionSnapshot(checkpoint);
      expect(snapshot).toBeDefined();
      expect(snapshot!.thoughtChain).toHaveLength(1);
      expect(snapshot!.thoughtChain[0].key).toBe('k1');
      // Should be a deep clone
      expect(snapshot!.thoughtChain).not.toBe(chain);
    });

    it('returns snapshot with thinkState when present', () => {
      const ts = { title: 'Thinking', content: 'content', loading: true, blink: true };
      const checkpoint = { thinkState: ts } as any;
      const snapshot = buildCheckpointCognitionSnapshot(checkpoint);
      expect(snapshot).toBeDefined();
      expect(snapshot!.thinkState).toBeDefined();
      expect(snapshot!.thinkState!.title).toBe('Thinking');
      // loading and blink should be forced to false
      expect(snapshot!.thinkState!.loading).toBe(false);
      expect(snapshot!.thinkState!.blink).toBe(false);
    });

    it('returns snapshot with both thoughtChain and thinkState', () => {
      const checkpoint = {
        thoughtChain: [{ key: 'k1', kind: 'reasoning', title: 't', status: 'success' }],
        thinkState: { title: 'T', content: 'C', loading: true, blink: true }
      } as any;
      const snapshot = buildCheckpointCognitionSnapshot(checkpoint);
      expect(snapshot!.thoughtChain).toHaveLength(1);
      expect(snapshot!.thinkState!.title).toBe('T');
    });

    it('captures capturedAt timestamp', () => {
      const checkpoint = { thinkState: { title: 'T' } } as any;
      const snapshot = buildCheckpointCognitionSnapshot(checkpoint);
      expect(snapshot!.capturedAt).toBeDefined();
      expect(new Date(snapshot!.capturedAt!).getTime()).not.toBeNaN();
    });

    it('includes thinkingDurationMs from thinkState', () => {
      const checkpoint = { thinkState: { title: 'T', thinkingDurationMs: 5000 } } as any;
      const snapshot = buildCheckpointCognitionSnapshot(checkpoint);
      expect(snapshot!.thinkingDurationMs).toBe(5000);
    });

    it('returns snapshot with empty thoughtChain when only thinkState exists', () => {
      const checkpoint = { thinkState: { title: 'T' } } as any;
      const snapshot = buildCheckpointCognitionSnapshot(checkpoint);
      expect(snapshot!.thoughtChain).toEqual([]);
    });
  });
});
