import { describe, expect, it } from 'vitest';
import { GatewayProviderQuotaSnapshotSchema } from '@agent/core';

import { CodexQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/codex-quota.inspector';
import { ClaudeQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/claude-quota.inspector';
import { GeminiQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/gemini-quota.inspector';
import { AntigravityQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/antigravity-quota.inspector';
import { KimiQuotaInspector } from '../../src/domains/agent-gateway/runtime-engine/accounting/kimi-quota.inspector';
import { AgentGatewayQuotaDetailService } from '../../src/domains/agent-gateway/quotas/agent-gateway-quota-detail.service';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

const refreshedAt = '2026-05-11T00:00:00.000Z';

describe('Agent Gateway provider quota inspectors', () => {
  it('detects Codex 5h and weekly quota windows from an auth file projection', async () => {
    const inspector = new CodexQuotaInspector({ now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        {
          id: 'codex-auth.json',
          providerKind: 'codex',
          accountEmail: 'coder@example.com',
          projectId: 'agent-prod',
          models: ['gpt-5-codex'],
          status: 'valid',
          quota: {
            fiveHour: { limit: 120, used: 45, resetAt: '2026-05-11T05:00:00.000Z' },
            weekly: { limit: 600, used: 200, resetAt: '2026-05-18T00:00:00.000Z' }
          }
        }
      ]
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map(item => item.window)).toEqual(['5h', 'weekly']);
    expect(snapshots[0]).toMatchObject({
      id: 'codex:codex-auth.json:gpt-5-codex:5h',
      providerKind: 'codex',
      authFileId: 'codex-auth.json',
      accountEmail: 'coder@example.com',
      model: 'gpt-5-codex',
      scope: 'model',
      limit: 120,
      used: 45,
      remaining: 75,
      status: 'normal',
      source: 'authFile',
      refreshedAt
    });
    expect(GatewayProviderQuotaSnapshotSchema.parse(snapshots[0])).toMatchObject({
      providerKind: 'codex',
      window: '5h'
    });
  });

  it('returns provider account and model scoped snapshots across deterministic provider harnesses', async () => {
    const inspectors = [
      new ClaudeQuotaInspector({ now: () => refreshedAt }),
      new GeminiQuotaInspector({ now: () => refreshedAt }),
      new AntigravityQuotaInspector({ now: () => refreshedAt }),
      new KimiQuotaInspector({ now: () => refreshedAt })
    ];

    const results = await Promise.all(
      inspectors.map(inspector =>
        inspector.inspect({
          authFiles: [
            {
              id: `${inspector.providerKind}-auth.json`,
              providerKind: inspector.providerKind,
              accountEmail: `${inspector.providerKind}@example.com`,
              projectId: 'agent-prod',
              models: [`${inspector.providerKind}-model`],
              status: 'valid',
              quota: { daily: { limit: 100, used: 25, resetAt: '2026-05-12T00:00:00.000Z' } }
            }
          ]
        })
      )
    );

    expect(results.flat().map(item => [item.providerKind, item.scope, item.model])).toEqual([
      ['claude', 'model', 'claude-model'],
      ['gemini', 'model', 'gemini-model'],
      ['antigravity', 'model', 'antigravity-model'],
      ['kimi', 'model', 'kimi-model']
    ]);
  });

  it('returns unknown status for invalid auth files without throwing', async () => {
    const inspector = new CodexQuotaInspector({ now: () => refreshedAt });

    await expect(
      inspector.inspect({
        authFiles: [
          {
            id: 'broken-codex.json',
            providerKind: 'codex',
            accountEmail: null,
            projectId: null,
            models: [],
            status: 'error',
            error: 'invalid auth file'
          }
        ]
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'codex:broken-codex.json:account:unknown',
        authFileId: 'broken-codex.json',
        scope: 'account',
        window: 'rolling',
        status: 'unknown',
        source: 'authFile',
        limit: null,
        remaining: null
      })
    ]);
  });

  it('refresh writes provider snapshots and returns normalized quota detail projection', async () => {
    const managementClient = new MemoryAgentGatewayManagementClient({
      quotaInspectors: [new CodexQuotaInspector({ now: () => refreshedAt })]
    });
    await managementClient.batchUploadAuthFiles({
      files: [
        {
          fileName: 'codex-auth.json',
          contentBase64: Buffer.from(
            JSON.stringify({
              accountEmail: 'coder@example.com',
              projectId: 'agent-prod',
              models: ['gpt-5-codex'],
              quota: {
                fiveHour: { limit: 120, used: 45, resetAt: '2026-05-11T05:00:00.000Z' },
                weekly: { limit: 600, used: 200, resetAt: '2026-05-18T00:00:00.000Z' }
              }
            })
          ).toString('base64')
        }
      ]
    });

    const service = new AgentGatewayQuotaDetailService(managementClient);
    await expect(service.refresh('codex')).resolves.toMatchObject({
      items: [
        {
          id: 'codex:codex-auth.json:gpt-5-codex:5h',
          providerId: 'codex',
          model: 'gpt-5-codex',
          scope: 'model',
          window: '5h',
          limit: 120,
          used: 45,
          remaining: 75,
          status: 'normal'
        },
        {
          id: 'codex:codex-auth.json:gpt-5-codex:weekly',
          providerId: 'codex',
          model: 'gpt-5-codex',
          scope: 'model',
          window: 'weekly',
          limit: 600,
          used: 200,
          remaining: 400,
          status: 'normal'
        }
      ]
    });
    const listed = await service.list();
    expect(listed.items).toContainEqual(expect.objectContaining({ id: 'codex:codex-auth.json:gpt-5-codex:5h' }));
  });
});
