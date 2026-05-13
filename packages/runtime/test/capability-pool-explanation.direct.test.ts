import { describe, expect, it } from 'vitest';

import { resolveCapabilityRedirect } from '../src/capabilities/capability-pool-explanation';

describe('capability-pool-explanation (direct)', () => {
  describe('resolveCapabilityRedirect', () => {
    it('returns no redirect when target is undefined', () => {
      const result = resolveCapabilityRedirect({ capabilityAttachments: [], executionMode: 'execute' } as any);
      expect(result.requestedTarget).toBeUndefined();
      expect(result.redirectedTarget).toBeUndefined();
      expect(result.requiresReadonlyFallback).toBe(false);
    });

    it('returns no redirect when target not found in attachments', () => {
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: [], executionMode: 'execute' } as any,
        'unknown-target'
      );
      expect(result.requestedTarget).toBe('unknown-target');
      expect(result.redirectedTarget).toBe('unknown-target');
      expect(result.attachment).toBeUndefined();
      expect(result.redirectAttachment).toBeUndefined();
    });

    it('finds attachment by id', () => {
      const attachments = [{ id: 'my-skill', displayName: 'Other', sourceId: 'src' }] as any;
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'my-skill'
      );
      expect(result.attachment).toBeDefined();
      expect(result.attachment!.id).toBe('my-skill');
    });

    it('finds attachment by displayName', () => {
      const attachments = [{ id: 'other', displayName: 'My Skill', sourceId: 'src' }] as any;
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'my skill'
      );
      expect(result.attachment).toBeDefined();
    });

    it('finds attachment by sourceId', () => {
      const attachments = [{ id: 'other', displayName: 'Other', sourceId: 'my-source' }] as any;
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'my-source'
      );
      expect(result.attachment).toBeDefined();
    });

    it('follows deprecated_in_favor_of redirect', () => {
      const attachments = [
        { id: 'old-skill', displayName: 'Old', sourceId: 'old', deprecated_in_favor_of: 'new-skill' },
        { id: 'new-skill', displayName: 'New', sourceId: 'new' }
      ] as any;
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'old-skill'
      );
      expect(result.redirectedTarget).toBe('new-skill');
      expect(result.redirectAttachment).toBeDefined();
      expect(result.redirectAttachment!.id).toBe('new-skill');
    });

    it('returns requiresReadonlyFallback true in plan mode', () => {
      const result = resolveCapabilityRedirect({ capabilityAttachments: [], executionMode: 'plan' } as any, 'target');
      expect(result.requiresReadonlyFallback).toBe(true);
    });

    it('is case-insensitive when matching', () => {
      const attachments = [{ id: 'My-Skill', displayName: 'Display', sourceId: 'src' }] as any;
      const result = resolveCapabilityRedirect(
        { capabilityAttachments: attachments, executionMode: 'execute' } as any,
        'my-skill'
      );
      expect(result.attachment).toBeDefined();
    });
  });
});
