import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runIntelScheduledJob } from '../../../src/runtime/intel/intel-runner';

const SOURCES_YAML = `defaults:
  recency_hours: 48
topics:
  - key: frontend_security
    enabled: true
    mode: patrol
    priority_default: P1
    queries:
      - axios vulnerability
  - key: ai_release
    enabled: true
    mode: ingest
    priority_default: P2
    queries:
      - OpenAI new model release
`;

const CHANNELS_YAML = `channels:
  security_alert:
    name: 安全告警群
    type: lark_webhook
    webhook_env: LARK_WEBHOOK_SECURITY_ALERT
    enabled: true
  digest_frontend:
    name: 前端日报群
    type: lark_webhook
    webhook_env: LARK_WEBHOOK_DIGEST_FRONTEND
    enabled: true
`;

const ROUTES_YAML = `defaults:
  suppress_duplicate_hours: 24
rules:
  - id: frontend-security-critical
    enabled: true
    when:
      category_in: [frontend_security]
      priority_in: [P0]
      status_in: [confirmed]
    send_to:
      - security_alert
    template: security_alert_full
  - id: frontend-digest
    enabled: true
    when:
      category_in: [frontend_security, ai_release]
      status_in: [confirmed]
      delivery_kind_in: [digest]
    send_to:
      - digest_frontend
    template: daily_digest
`;

async function writeIntelConfig(workspaceRoot: string) {
  const configDir = join(workspaceRoot, 'config', 'intel');
  await mkdir(configDir, { recursive: true });
  await Promise.all([
    writeFile(join(configDir, 'sources.yaml'), SOURCES_YAML, 'utf8'),
    writeFile(join(configDir, 'channels.yaml'), CHANNELS_YAML, 'utf8'),
    writeFile(join(configDir, 'routes.yaml'), ROUTES_YAML, 'utf8')
  ]);
}

describe('runIntelScheduledJob', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('runs patrol jobs from workspace config through queued deliveries', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'intel-runner-'));
    tempDirs.push(workspaceRoot);
    await writeIntelConfig(workspaceRoot);

    const result = await runIntelScheduledJob({
      jobName: 'intel-patrol',
      workspaceRoot,
      startedAt: '2026-04-24T12:00:00.000Z',
      mcpClientManager: {
        hasCapability: () => true,
        invokeTool: async () => ({
          ok: true,
          rawOutput: {
            results: [
              {
                title: 'Axios security advisory',
                url: 'https://github.com/axios/axios/security/advisories/1',
                summary: 'Axios 发布了安全公告',
                publishedAt: '2026-04-24T11:58:00.000Z',
                sourceName: 'github',
                sourceType: 'official'
              }
            ]
          }
        })
      }
    });

    expect(result.jobName).toBe('intel-patrol');
    expect(result.summary.generatedAlerts).toBe(1);
    expect(result.summary.queuedDeliveries).toBe(1);
  });

  it('retries pending deliveries with configured Lark channels', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'intel-retry-runner-'));
    tempDirs.push(workspaceRoot);
    await writeIntelConfig(workspaceRoot);

    await runIntelScheduledJob({
      jobName: 'intel-patrol',
      workspaceRoot,
      startedAt: '2026-04-24T12:00:00.000Z',
      mcpClientManager: {
        hasCapability: () => true,
        invokeTool: async () => ({
          ok: true,
          rawOutput: {
            results: [
              {
                title: 'Axios security advisory',
                url: 'https://github.com/axios/axios/security/advisories/1',
                summary: 'Axios 发布了安全公告',
                publishedAt: '2026-04-24T11:58:00.000Z',
                sourceName: 'github',
                sourceType: 'official'
              }
            ]
          }
        })
      }
    });

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"StatusCode":0}'
    })) as unknown as typeof fetch;

    const result = await runIntelScheduledJob({
      jobName: 'intel-delivery-retry',
      workspaceRoot,
      startedAt: '2026-04-24T12:15:00.000Z',
      env: {
        LARK_WEBHOOK_SECURITY_ALERT: 'https://example.com/lark/webhook'
      },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.jobName).toBe('intel-delivery-retry');
    expect(result.summary.sentDeliveries).toBe(1);
  });

  it('runs digest jobs from workspace config and creates digest deliveries instead of skipping', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'intel-digest-runner-'));
    tempDirs.push(workspaceRoot);
    await writeIntelConfig(workspaceRoot);

    await runIntelScheduledJob({
      jobName: 'intel-patrol',
      workspaceRoot,
      startedAt: '2026-04-24T12:00:00.000Z',
      mcpClientManager: {
        hasCapability: () => true,
        invokeTool: async (_toolName, request) => ({
          ok: true,
          rawOutput: {
            results:
              request.input.query === 'axios vulnerability'
                ? [
                    {
                      title: 'Axios security advisory',
                      url: 'https://github.com/axios/axios/security/advisories/1',
                      summary: 'Axios 发布了安全公告',
                      publishedAt: '2026-04-24T10:00:00.000Z',
                      sourceName: 'github',
                      sourceType: 'official'
                    }
                  ]
                : [
                    {
                      title: 'OpenAI new model release',
                      url: 'https://openai.com/index/new-model',
                      summary: 'OpenAI 发布新模型',
                      publishedAt: '2026-04-24T11:00:00.000Z',
                      sourceName: 'openai',
                      sourceType: 'official'
                    }
                  ]
          }
        })
      }
    });

    const result = await runIntelScheduledJob({
      jobName: 'intel-digest',
      workspaceRoot,
      startedAt: '2026-04-24T21:00:00.000Z'
    });

    expect(result.status).toBe('completed');
    expect(result.jobName).toBe('intel-digest');
    expect(result.summary.digests).toBeGreaterThan(0);
    expect(result.summary.queuedDeliveries).toBeGreaterThan(0);
  });
});
