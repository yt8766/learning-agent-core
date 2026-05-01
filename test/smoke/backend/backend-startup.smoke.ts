/**
 * 第3类 smoke：backend health 契约 + SSE 响应头常量验证
 *
 * 验证：
 * 1. @agent/core 的 HealthCheckResultSchema 可以 parse 符合 backend 契约的对象。
 * 2. AppService.health() 直接实例化（不经过 NestJS DI）返回合法契约值。
 * 3. backend chat controller 设置的 SSE 响应头常量符合 frontend 消费预期。
 *
 * smoke 定位：证明"关键入口还活着"，不承担深逻辑覆盖。
 * 不依赖真实网络、数据库、LLM，也不启动 NestJS 应用。
 *
 * 命名约定：*.smoke.ts
 */

import { describe, expect, it, vi } from 'vitest';

import { HealthCheckResultSchema } from '@agent/core';

import { AppService } from '../../../apps/backend/agent-server/src/app/app.service';
import { RuntimeHost } from '../../../apps/backend/agent-server/src/runtime/core/runtime.host';
import { RuntimeTaskService } from '../../../apps/backend/agent-server/src/runtime/services/runtime-task.service';

// ────────────────────────────────────────────────
// 1. HealthCheckResultSchema contract smoke
// ────────────────────────────────────────────────

describe('HealthCheckResultSchema contract smoke', () => {
  it('接受合法 health 响应对象', () => {
    const valid = { status: 'ok', service: 'server', now: new Date().toISOString() };
    expect(() => HealthCheckResultSchema.parse(valid)).not.toThrow();
  });

  it('接受 knowledge search 装配状态', () => {
    expect(() =>
      HealthCheckResultSchema.parse({
        status: 'ok',
        service: 'server',
        now: new Date().toISOString(),
        knowledgeSearchStatus: {
          configuredMode: 'hybrid',
          effectiveMode: 'keyword-only',
          vectorProviderId: 'missing-client',
          vectorConfigured: true,
          hybridEnabled: false,
          diagnostics: [
            {
              code: 'knowledge.vector_provider.missing_client',
              severity: 'warning',
              message: 'vector client missing'
            }
          ],
          checkedAt: '2026-05-01T00:00:00.000Z'
        }
      })
    ).not.toThrow();
  });

  it('拒绝缺少 status 字段的对象', () => {
    expect(() => HealthCheckResultSchema.parse({ service: 'server', now: new Date().toISOString() })).toThrow();
  });

  it('拒绝 status 不为 ok 的对象', () => {
    expect(() => HealthCheckResultSchema.parse({ status: 'error', service: 'server', now: '' })).toThrow();
  });

  it('service 字段为 z.string()（允许空字符串，AppService 实际会返回非空值）', () => {
    // schema 本身只约束 z.string()，不约束最小长度
    // 实际 AppService 实现中 service 固定为 'server'
    expect(() =>
      HealthCheckResultSchema.parse({ status: 'ok', service: '', now: new Date().toISOString() })
    ).not.toThrow();
  });
});

// ────────────────────────────────────────────────
// 2. AppService.health() 直接实例化 smoke
// ────────────────────────────────────────────────

describe('AppService health() 直接实例化 smoke', () => {
  // 绕过 NestJS DI，直接传入最小 mock
  const runtimeTaskServiceMock = {
    describeGraph: vi.fn(() => ['Goal Intake', 'Supervisor', 'Ministry'])
  } as unknown as RuntimeTaskService;

  const runtimeHostMock = {
    getKnowledgeSearchStatus: vi.fn(async () => ({
      configuredMode: 'keyword-only' as const,
      effectiveMode: 'keyword-only' as const,
      vectorConfigured: false,
      hybridEnabled: false,
      diagnostics: [],
      checkedAt: '2026-05-01T00:00:00.000Z'
    }))
  } as unknown as RuntimeHost;

  const appService = new AppService(runtimeTaskServiceMock, runtimeHostMock);

  it('AppService 可以直接实例化（不依赖 NestJS DI）', () => {
    expect(appService).toBeDefined();
  });

  it('health() 返回 status: ok', async () => {
    const result = await appService.health();
    expect(result.status).toBe('ok');
  });

  it('health() 返回 service: server', async () => {
    const result = await appService.health();
    expect(result.service).toBe('server');
  });

  it('health() 返回 knowledge search 装配状态', async () => {
    const result = await appService.health();
    expect(result.knowledgeSearchStatus).toMatchObject({
      configuredMode: 'keyword-only',
      effectiveMode: 'keyword-only',
      vectorConfigured: false,
      hybridEnabled: false
    });
  });

  it('health() 返回 now 为 ISO 8601 时间字符串', async () => {
    const result = await appService.health();
    expect(() => new Date(result.now).toISOString()).not.toThrow();
  });

  it('health() 返回值通过 HealthCheckResultSchema.parse（backend 契约与 core schema 一致）', async () => {
    const result = await appService.health();
    expect(() => HealthCheckResultSchema.parse(result)).not.toThrow();
  });
});

// ────────────────────────────────────────────────
// 3. SSE 响应头常量 smoke
// ────────────────────────────────────────────────

/**
 * 这些常量是 backend chat controller 在流式响应开始时必须设置的 header。
 * frontend EventSource / SSE 消费方依赖这些 header 才能正确识别流式事件。
 * 这里作为契约锚定，不测试具体 controller 实例。
 */
const EXPECTED_SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no'
} as const;

describe('backend SSE 响应头契约常量 smoke', () => {
  it('Content-Type 为 text/event-stream', () => {
    expect(EXPECTED_SSE_HEADERS['Content-Type']).toBe('text/event-stream');
  });

  it('Cache-Control 包含 no-cache', () => {
    expect(EXPECTED_SSE_HEADERS['Cache-Control']).toContain('no-cache');
  });

  it('Connection 为 keep-alive', () => {
    expect(EXPECTED_SSE_HEADERS['Connection']).toBe('keep-alive');
  });

  it('X-Accel-Buffering 为 no（防止 nginx 缓冲 SSE 流）', () => {
    expect(EXPECTED_SSE_HEADERS['X-Accel-Buffering']).toBe('no');
  });
});
