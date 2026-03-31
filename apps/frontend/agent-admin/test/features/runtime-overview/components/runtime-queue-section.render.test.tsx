import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeQueueSection } from '@/features/runtime-overview/components/runtime-queue-section';

describe('RuntimeQueueSection render smoke', () => {
  it('renders specialist routing, findings and trace fallback metadata', () => {
    const html = renderToStaticMarkup(
      <RuntimeQueueSection
        runtime={
          {
            recentRuns: [
              {
                id: 'task-1',
                goal: '评估 VIP 产品规划',
                status: 'running',
                approvals: [],
                updatedAt: '2026-03-28T00:00:00.000Z',
                createdAt: '2026-03-28T00:00:00.000Z'
              }
            ],
            activeWorkerSlots: [],
            usageAnalytics: { models: [] }
          } as any
        }
        bundle={{
          task: {
            id: 'task-1',
            goal: '评估 VIP 产品规划',
            status: 'running',
            approvals: [],
            updatedAt: '2026-03-28T00:00:00.000Z',
            createdAt: '2026-03-28T00:00:00.000Z',
            specialistLead: {
              id: 'product-strategy',
              displayName: '产品策略专家',
              domain: 'product-strategy',
              reason: '当前问题涉及产品优先级和商业闭环。'
            },
            supportingSpecialists: [
              {
                id: 'risk-compliance',
                displayName: '风控合规专家',
                domain: 'risk-compliance',
                reason: '补充套利与风控约束'
              }
            ],
            routeConfidence: 0.91,
            critiqueResult: {
              decision: 'needs_human_approval',
              summary: '涉及高风险执行，需确认。',
              constraints: ['需要用户最终确认']
            },
            revisionCount: 1,
            maxRevisions: 2,
            specialistFindings: [
              {
                specialistId: 'risk-compliance',
                role: 'support',
                contractVersion: 'specialist-finding.v1',
                source: 'critique',
                stage: 'review',
                domain: 'risk-compliance',
                summary: 'JackPot 玩法存在资金池穿透风险。',
                riskLevel: 'high',
                blockingIssues: ['需设置赔付上限'],
                constraints: ['必须增加熔断开关'],
                suggestions: ['先灰度发布再全量'],
                confidence: 0.88
              }
            ]
          },
          agents: [],
          messages: [],
          traces: [
            {
              node: 'route',
              at: '2026-03-28T10:00:00.000Z',
              summary: '吏部完成路由。',
              spanId: 'span-route',
              role: 'ministry',
              status: 'success',
              latencyMs: 32
            },
            {
              node: 'planning_readonly_guard',
              at: '2026-03-28T10:00:00.500Z',
              summary: '规划阶段已启用只读研究边界。',
              spanId: 'span-guard',
              parentSpanId: 'span-route',
              role: 'ministry',
              status: 'success',
              latencyMs: 24
            },
            {
              node: 'review',
              at: '2026-03-28T10:00:01.000Z',
              summary: '刑部触发后备模型重试。',
              spanId: 'span-review',
              parentSpanId: 'span-route',
              role: 'ministry',
              modelUsed: 'gpt-4o-mini',
              status: 'success',
              latencyMs: 280,
              isFallback: true,
              fallbackReason: 'provider_timeout'
            }
          ],
          audit: {
            taskId: 'task-1',
            entries: [
              {
                id: 'audit-1',
                at: '2026-03-28T10:00:00.500Z',
                type: 'trace',
                title: 'planning_readonly_guard',
                summary: '规划阶段已启用只读研究边界。'
              }
            ],
            browserReplays: [],
            traceSummary: {
              criticalPaths: [
                {
                  pathLabel: 'route -> review',
                  totalLatencyMs: 312,
                  spanCount: 2,
                  fallbackNodes: ['review'],
                  reviseNodes: []
                }
              ],
              fallbackSpans: ['review'],
              reviseSpans: [],
              roleLatencyBreakdown: [
                {
                  role: 'ministry',
                  totalLatencyMs: 336,
                  spanCount: 3
                }
              ],
              slowestSpan: {
                node: 'review',
                latencyMs: 280
              }
            }
          }
        }}
        historyDays={7}
        onHistoryDaysChange={vi.fn()}
        statusFilter=""
        onStatusFilterChange={vi.fn()}
        modelFilter=""
        onModelFilterChange={vi.fn()}
        pricingSourceFilter=""
        onPricingSourceFilterChange={vi.fn()}
        executionModeFilter="all"
        onExecutionModeFilterChange={vi.fn()}
        interactionKindFilter="all"
        onInteractionKindFilterChange={vi.fn()}
        onCopyShareLink={vi.fn()}
        onExport={vi.fn()}
        onSelectTask={vi.fn()}
        onRetryTask={vi.fn()}
        onRefreshRuntime={vi.fn()}
        onCreateDiagnosisTask={vi.fn()}
      />
    );

    expect(html).toContain('产品策略专家');
    expect(html).toContain('当前问题涉及产品优先级和商业闭环');
    expect(html).toContain('置信 91% / high');
    expect(html).toContain('JackPot 玩法存在资金池穿透风险');
    expect(html).toContain('需设置赔付上限');
    expect(html).toContain('specialist-finding.v1');
    expect(html).toContain('critique');
    expect(html).toContain('review');
    expect(html).toContain('gpt-4o-mini');
    expect(html).toContain('fallback reason: provider_timeout');
    expect(html).toContain('from route');
    expect(html).toContain('Trace Waterfall');
    expect(html).toContain('Critical Path');
    expect(html).toContain('route -&gt; review');
    expect(html).toContain('计划只读保护');
    expect(html).toContain('当前主动跳过 open-web、浏览器、终端与写入路径');
  });
});
