import { describe, expect, it } from 'vitest';

import { resolveCapabilityRedirect } from '../src/capabilities/capability-pool-explanation';

describe('capability-pool-explanation', () => {
  describe('resolveCapabilityRedirect', () => {
    it('returns readonly fallback when target is undefined', () => {
      const result = resolveCapabilityRedirect({ capabilityAttachments: [], executionMode: 'plan' } as any);
      expect(result.requestedTarget).toBeUndefined();
      expect(result.redirectedTarget).toBeUndefined();
      expect(result.requiresReadonlyFallback).toBe(true);
    });

    it('returns requiresReadonlyFallback false when not in plan mode', () => {
      const result = resolveCapabilityRedirect({ capabilityAttachments: [], executionMode: 'execute' } as any);
      expect(result.requiresReadonlyFallback).toBe(false);
    });

    it('finds matching attachment by id', () => {
      const attachments = [{ id: 'tool-a', displayName: 'Tool A', sourceId: 'src-a' }];
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'tool-a'
      );
      expect(result.attachment).toBeDefined();
      expect(result.attachment!.id).toBe('tool-a');
      expect(result.redirectedTarget).toBe('tool-a');
    });

    it('finds matching attachment by displayName (case-insensitive)', () => {
      const attachments = [{ id: 'tool-a', displayName: 'GitHub MCP', sourceId: 'src-a' }];
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'github mcp'
      );
      expect(result.attachment).toBeDefined();
    });

    it('finds matching attachment by sourceId', () => {
      const attachments = [{ id: 'tool-a', displayName: 'Tool A', sourceId: 'source-x' }];
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'source-x'
      );
      expect(result.attachment).toBeDefined();
    });

    it('follows deprecated_in_favor_of redirect', () => {
      const attachments = [
        { id: 'old-tool', displayName: 'Old Tool', sourceId: 'src-a', deprecated_in_favor_of: 'new-tool' },
        { id: 'new-tool', displayName: 'New Tool', sourceId: 'src-b' }
      ];
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'old-tool'
      );
      expect(result.requestedTarget).toBe('old-tool');
      expect(result.redirectedTarget).toBe('new-tool');
      expect(result.redirectAttachment).toBeDefined();
      expect(result.redirectAttachment!.id).toBe('new-tool');
    });

    it('returns undefined redirectAttachment when replacement not found', () => {
      const attachments = [{ id: 'old-tool', displayName: 'Old Tool', deprecated_in_favor_of: 'missing-tool' }];
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'old-tool'
      );
      expect(result.redirectedTarget).toBe('missing-tool');
      expect(result.redirectAttachment).toBeUndefined();
    });

    it('returns no attachment when target not found', () => {
      const attachments = [{ id: 'tool-a', displayName: 'Tool A' }];
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'nonexistent'
      );
      expect(result.attachment).toBeUndefined();
      expect(result.redirectedTarget).toBe('nonexistent');
    });

    it('handles missing capabilityAttachments array', () => {
      const result = resolveCapabilityRedirect({ executionMode: 'execute' } as any, 'target');
      expect(result.attachment).toBeUndefined();
    });
  });
});
