import { describe, expect, it } from 'vitest';

import { AntigravityQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/antigravity-quota.inspector';
import { ClaudeQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/claude-quota.inspector';
import { CodexQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/codex-quota.inspector';
import { GeminiQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/gemini-quota.inspector';
import { KimiQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/kimi-quota.inspector';

const refreshedAt = '2026-05-11T00:00:00.000Z';

describe('quota inspector subclasses', () => {
  it('AntigravityQuotaInspector sets provider kind and default model', () => {
    const inspector = new AntigravityQuotaInspector({ now: () => refreshedAt });
    expect(inspector.providerKind).toBe('antigravity');
  });

  it('ClaudeQuotaInspector sets provider kind and default model', () => {
    const inspector = new ClaudeQuotaInspector({ now: () => refreshedAt });
    expect(inspector.providerKind).toBe('claude');
  });

  it('CodexQuotaInspector sets provider kind and default model', () => {
    const inspector = new CodexQuotaInspector({ now: () => refreshedAt });
    expect(inspector.providerKind).toBe('codex');
  });

  it('GeminiQuotaInspector sets provider kind and default model', () => {
    const inspector = new GeminiQuotaInspector({ now: () => refreshedAt });
    expect(inspector.providerKind).toBe('gemini');
  });

  it('KimiQuotaInspector sets provider kind and default model', () => {
    const inspector = new KimiQuotaInspector({ now: () => refreshedAt });
    expect(inspector.providerKind).toBe('kimi');
  });

  it('AntigravityQuotaInspector uses antigravity-model as default model', async () => {
    const inspector = new AntigravityQuotaInspector({ now: () => refreshedAt });
    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'antigravity',
          status: 'valid',
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });
    expect(snapshots[0].model).toBe('antigravity-model');
  });

  it('ClaudeQuotaInspector uses claude-opus-4 as default model', async () => {
    const inspector = new ClaudeQuotaInspector({ now: () => refreshedAt });
    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'claude',
          status: 'valid',
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });
    expect(snapshots[0].model).toBe('claude-opus-4');
  });

  it('CodexQuotaInspector uses gpt-5-codex as default model', async () => {
    const inspector = new CodexQuotaInspector({ now: () => refreshedAt });
    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'codex',
          status: 'valid',
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });
    expect(snapshots[0].model).toBe('gpt-5-codex');
  });

  it('GeminiQuotaInspector uses gemini-2.5-pro as default model', async () => {
    const inspector = new GeminiQuotaInspector({ now: () => refreshedAt });
    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'gemini',
          status: 'valid',
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });
    expect(snapshots[0].model).toBe('gemini-2.5-pro');
  });

  it('KimiQuotaInspector uses kimi-k2 as default model', async () => {
    const inspector = new KimiQuotaInspector({ now: () => refreshedAt });
    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'auth1',
          providerKind: 'kimi',
          status: 'valid',
          quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
        }
      ]
    });
    expect(snapshots[0].model).toBe('kimi-k2');
  });

  it('each inspector only picks up auth files matching its provider kind', async () => {
    const inspectors = [
      new AntigravityQuotaInspector({ now: () => refreshedAt }),
      new ClaudeQuotaInspector({ now: () => refreshedAt }),
      new CodexQuotaInspector({ now: () => refreshedAt }),
      new GeminiQuotaInspector({ now: () => refreshedAt }),
      new KimiQuotaInspector({ now: () => refreshedAt })
    ];

    const authFiles = inspectors.map(inspector => ({
      id: `${inspector.providerKind}-auth`,
      providerKind: inspector.providerKind,
      status: 'valid' as const,
      quota: { daily: { limit: 100, used: 50, resetAt: '2026-05-12T00:00:00.000Z' } }
    }));

    for (const inspector of inspectors) {
      const snapshots = await inspector.inspect({ authFiles });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].providerKind).toBe(inspector.providerKind);
    }
  });

  it('each inspector returns unknown snapshot for error status auth files', async () => {
    const inspectors = [
      new AntigravityQuotaInspector({ now: () => refreshedAt }),
      new ClaudeQuotaInspector({ now: () => refreshedAt }),
      new CodexQuotaInspector({ now: () => refreshedAt }),
      new GeminiQuotaInspector({ now: () => refreshedAt }),
      new KimiQuotaInspector({ now: () => refreshedAt })
    ];

    for (const inspector of inspectors) {
      const snapshots = await inspector.inspect({
        authFiles: [
          {
            id: `${inspector.providerKind}-broken`,
            providerKind: inspector.providerKind,
            status: 'error'
          }
        ]
      });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].status).toBe('unknown');
      expect(snapshots[0].id).toContain(inspector.providerKind);
    }
  });

  it('constructors work with no options argument', () => {
    expect(() => new AntigravityQuotaInspector()).not.toThrow();
    expect(() => new ClaudeQuotaInspector()).not.toThrow();
    expect(() => new CodexQuotaInspector()).not.toThrow();
    expect(() => new GeminiQuotaInspector()).not.toThrow();
    expect(() => new KimiQuotaInspector()).not.toThrow();
  });
});
