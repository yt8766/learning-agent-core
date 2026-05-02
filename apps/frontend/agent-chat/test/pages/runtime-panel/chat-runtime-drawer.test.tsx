import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ChatRuntimeDrawer,
  getInterruptStatusSummary,
  getRuntimeDrawerExportFilters,
  getRuntimeDrawerExportScopeCopy
} from '@/pages/runtime-panel/chat-runtime-drawer';
import { ExecutionStepsCard, WorkflowRolesCard } from '@/pages/runtime-panel/chat-runtime-drawer-cards';
import { buildPendingPlanQuestionCheckpoint } from '../../fixtures/chat-session-fixtures';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    Drawer: ({ open, title, children }: { open?: boolean; title?: string; children?: ReactNode }) =>
      open ? (
        <section data-testid="drawer-mock">
          <h2>{title}</h2>
          {children}
        </section>
      ) : null
  };
});

vi.mock('@ant-design/x', () => ({
  Think: ({ title, children }: { title?: ReactNode; children?: ReactNode }) => (
    <section data-testid="think-mock">
      <div>{title}</div>
      <div>{children}</div>
    </section>
  ),
  ThoughtChain: ({ items }: { items?: Array<{ title?: ReactNode; description?: ReactNode }> }) => (
    <section data-testid="thought-chain-mock">
      {items?.map((item, index) => (
        <article key={index}>
          <div>{item.title}</div>
          <div>{item.description}</div>
        </article>
      ))}
    </section>
  )
}));

describe('chat-runtime-drawer helpers', () => {
  it('formats plan-question interrupt summary', () => {
    expect(getInterruptStatusSummary(buildPendingPlanQuestionCheckpoint())).toContain('计划提问');
  });

  it('formats watchdog runtime-governance summary', () => {
    expect(
      getInterruptStatusSummary({
        ...buildPendingPlanQuestionCheckpoint(),
        activeInterrupt: {
          id: 'interrupt-watchdog',
          status: 'pending',
          mode: 'blocking',
          source: 'tool',
          kind: 'runtime-governance',
          intent: 'run_terminal',
          toolName: 'run_terminal',
          riskLevel: 'high',
          resumeStrategy: 'approval-recovery',
          createdAt: '2026-04-01T12:00:00.000Z',
          payload: {
            interactionKind: 'supplemental-input',
            watchdog: true,
            runtimeGovernanceReasonCode: 'watchdog_timeout'
          }
        }
      } as any)
    ).toContain('运行时治理中断');
  });

  it('derives export filters from checkpoint state', () => {
    expect(getRuntimeDrawerExportFilters(buildPendingPlanQuestionCheckpoint())).toEqual({
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
  });

  it('describes export scope using current checkpoint filters', () => {
    expect(getRuntimeDrawerExportScopeCopy(buildPendingPlanQuestionCheckpoint())).toContain('执行边界：计划模式');
  });

  it('renders governance and critic summaries without leaking raw blocking issue details', () => {
    const checkpoint = {
      ...buildPendingPlanQuestionCheckpoint(),
      currentMinistry: 'xingbu-review',
      currentWorker: 'worker-xingbu',
      criticState: {
        decision: 'rewrite_required',
        summary: '批判层要求先回流调度链修订。',
        blockingIssues: ['internal raw critique detail'],
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      governanceReport: {
        summary: '治理链建议保守提升信任。',
        reviewOutcome: {
          decision: 'pass',
          summary: '终审通过。'
        },
        evidenceSufficiency: {
          score: 88,
          summary: '证据充分。'
        },
        sandboxReliability: {
          score: 90,
          summary: 'sandbox 稳定。'
        }
      }
    } as any;

    const html = renderToStaticMarkup(
      <WorkflowRolesCard checkpoint={checkpoint} routeReason="test" getAgentLabel={role => role ?? '--'} />
    );

    expect(html).toContain('治理报告摘要');
    expect(html).toContain('批判层：rewrite_required');
    expect(html).not.toContain('internal raw critique detail');
  });

  it('renders runtime drawer sections for session, compression, approvals, model route and thought timeline', () => {
    const checkpoint = {
      ...buildPendingPlanQuestionCheckpoint(),
      executionMode: 'plan',
      currentMinistry: 'gongbu-code',
      currentWorker: 'worker-gongbu',
      streamStatus: {
        nodeId: 'planning',
        nodeLabel: '文书科',
        detail: '正在整理上下文并生成计划问题',
        progressPercent: 45,
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      resolvedWorkflow: {
        displayName: '通用协同流',
        requiredMinistries: ['gongbu-code', 'xingbu-review']
      },
      chatRoute: {
        graph: 'workflow',
        flow: 'supervisor',
        reason: 'modification_intent',
        adapter: 'modification-intent',
        priority: 70,
        stepsSummary: [
          {
            id: 'execution_step_workflow-execute_request-received',
            route: 'workflow-execute',
            stage: 'request-received',
            label: '接收请求',
            owner: 'session',
            status: 'completed',
            startedAt: '2026-03-31T00:00:00.000Z',
            detail: '收到目标'
          },
          {
            id: 'execution_step_workflow-execute_execution',
            route: 'workflow-execute',
            stage: 'execution',
            label: '执行实施',
            owner: 'gongbu',
            status: 'running',
            startedAt: '2026-03-31T00:00:05.000Z',
            detail: '工部正在执行'
          }
        ]
      },
      currentExecutionStep: {
        id: 'execution_step_workflow-execute_execution',
        route: 'workflow-execute',
        stage: 'execution',
        label: '执行实施',
        owner: 'gongbu',
        status: 'running',
        startedAt: '2026-03-31T00:00:05.000Z',
        detail: '工部正在执行'
      },
      modelRoute: [
        {
          role: 'manager',
          modelId: 'gpt-5.4',
          providerId: 'openai',
          reason: '计划模式优先高质量推理'
        }
      ]
    } as any;

    const html = renderToStaticMarkup(
      <ChatRuntimeDrawer
        open
        activeSession={
          {
            id: 'session-1',
            title: '调试 runtime 覆盖率',
            status: 'running',
            compression: {
              summary: 'Earlier Context 已压缩',
              source: 'llm',
              trigger: 'message_count',
              condensedMessageCount: 12,
              condensedCharacterCount: 600,
              totalCharacterCount: 1400,
              focuses: ['覆盖率门槛', 'runtime center'],
              risks: ['漏测分支'],
              nextActions: ['补测关键面板'],
              keyDeliverables: ['coverage baseline'],
              supportingFacts: ['已有 runtime 中心测试'],
              previewMessages: ['上一轮对话摘要'],
              periodOrTopic: '覆盖率治理',
              updatedAt: '2026-03-31T00:00:00.000Z'
            }
          } as any
        }
        checkpoint={checkpoint}
        thinkState={{
          title: '礼部整理中',
          loading: true,
          blink: true,
          content: '正在汇总导出与恢复入口'
        }}
        pendingApprovals={[
          {
            intent: 'enable_connector',
            decision: 'pending',
            riskLevel: 'high',
            toolName: 'github-mcp',
            reasonCode: 'destructive'
          } as any
        ]}
        thoughtItems={[
          {
            key: 'thought-1',
            title: '文书科',
            description: '整理计划问题'
          } as any
        ]}
        onClose={() => undefined}
        onConfirmLearning={() => undefined}
        onRecover={() => undefined}
        onExportRuntime={() => undefined}
        onExportApprovals={() => undefined}
        onDownloadReplay={() => undefined}
        onCopyShareLinks={() => undefined}
        getAgentLabel={role => role ?? '--'}
        getSessionStatusLabel={status => status ?? '--'}
      />
    );

    expect(html).toContain('工作台');
    expect(html).toContain('导出 runtime');
    expect(html).toContain('Earlier Context 已压缩');
    expect(html).toContain('通用协同流');
    expect(html).toContain('github-mcp');
    expect(html).toContain('礼部整理中');
    expect(html).toContain('覆盖率治理');
    expect(html).toContain('执行步骤');
    expect(html).toContain('工部正在执行');
  });

  it('renders execution step projection with current owner and reason', () => {
    const html = renderToStaticMarkup(
      <ExecutionStepsCard
        checkpoint={
          {
            currentExecutionStep: {
              id: 'execution_step_workflow-execute_approval-interrupt',
              route: 'workflow-execute',
              stage: 'approval-interrupt',
              label: '审批中断',
              owner: 'system',
              status: 'blocked',
              startedAt: '2026-03-31T00:00:00.000Z',
              reason: '执行链已暂停等待审批。'
            },
            executionSteps: [
              {
                id: 'execution_step_workflow-execute_request-received',
                route: 'workflow-execute',
                stage: 'request-received',
                label: '接收请求',
                owner: 'session',
                status: 'completed',
                startedAt: '2026-03-31T00:00:00.000Z'
              },
              {
                id: 'execution_step_workflow-execute_approval-interrupt',
                route: 'workflow-execute',
                stage: 'approval-interrupt',
                label: '审批中断',
                owner: 'system',
                status: 'blocked',
                startedAt: '2026-03-31T00:00:01.000Z',
                reason: '执行链已暂停等待审批。'
              }
            ]
          } as any
        }
      />
    );

    expect(html).toContain('审批中断');
    expect(html).toContain('系统负责');
    expect(html).toContain('执行链已暂停等待审批');
  });
});
