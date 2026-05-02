import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedButtons: Array<{ children?: unknown; onClick?: () => void }> = [];

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

import {
  getExecutionModeLabel,
  getInteractionKindLabel,
  getRuntimeGovernanceReasonLabel,
  filterRuntimeInterruptItems,
  RuntimeSummaryTools,
  toRuntimeInterruptItems
} from '@/pages/runtime-overview/components/runtime-summary-tools';

describe('RuntimeSummaryTools helpers', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
  });

  it('maps labels and transforms recent runs into interrupt items', () => {
    expect(getExecutionModeLabel('plan')).toBeTruthy();
    expect(getExecutionModeLabel(undefined)).toBe('未标记');
    expect(getInteractionKindLabel('plan-question')).toBe('计划提问');
    expect(getInteractionKindLabel('supplemental-input')).toBe('补充输入');
    expect(getInteractionKindLabel('approval')).toBe('操作确认');
    expect(getRuntimeGovernanceReasonLabel('watchdog_timeout')).toBe('运行时超时阻塞');
    expect(getRuntimeGovernanceReasonLabel('custom_reason')).toBe('custom_reason');

    const items = toRuntimeInterruptItems({
      recentRuns: [
        {
          id: 'task-plan',
          goal: '先整理方案',
          status: 'waiting_interrupt',
          executionMode: 'planning-readonly',
          currentMinistry: 'gongbu-code',
          currentWorker: 'worker-gongbu',
          updatedAt: '2026-03-29T10:00:00.000Z',
          activeInterrupt: {
            kind: 'user-input',
            payload: { interactionKind: 'plan-question' }
          },
          planDraft: {
            questionSet: { title: '需要补充计划边界' }
          }
        },
        {
          id: 'task-watchdog',
          goal: '终端执行卡住',
          status: 'waiting_approval',
          executionMode: 'execute',
          currentNode: 'runtime_governance_gate',
          currentMinistry: 'bingbu-ops',
          currentWorker: 'worker-bingbu',
          updatedAt: '2026-03-29T11:00:00.000Z',
          activeInterrupt: {
            kind: 'runtime-governance',
            payload: {
              interactionKind: 'supplemental-input',
              watchdog: true,
              runtimeGovernanceReasonCode: 'watchdog_timeout'
            }
          }
        }
      ]
    } as any);

    expect(items[0]).toEqual(
      expect.objectContaining({
        taskId: 'task-watchdog',
        isRuntimeGovernance: true,
        isWatchdog: true,
        reasonLabel: '运行时超时阻塞'
      })
    );
    expect(items[1]).toEqual(
      expect.objectContaining({
        taskId: 'task-plan',
        executionMode: 'plan',
        interactionKind: 'plan-question',
        interruptLabel: '需要补充计划边界'
      })
    );
  });

  it('filters interrupt items by execution mode and interaction kind', () => {
    const filtered = filterRuntimeInterruptItems(
      [
        {
          taskId: 'task-plan',
          goal: '先给方案',
          status: 'waiting_interrupt',
          executionMode: 'plan',
          interactionKind: 'plan-question',
          interruptLabel: '计划问题',
          updatedAt: '2026-03-29T10:00:00.000Z'
        },
        {
          taskId: 'task-approval',
          goal: '发布配置',
          status: 'waiting_approval',
          executionMode: 'execute',
          interactionKind: 'approval',
          interruptLabel: 'enable_connector',
          updatedAt: '2026-03-29T09:00:00.000Z'
        }
      ],
      { executionMode: 'plan', interactionKind: 'plan-question' }
    );

    expect(filtered).toEqual([
      expect.objectContaining({
        taskId: 'task-plan',
        executionMode: 'plan',
        interactionKind: 'plan-question'
      })
    ]);
  });

  it('renders interrupt, recent usage and blocked reason sections', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryTools
        runtime={
          {
            taskCount: 12,
            activeTaskCount: 3,
            pendingApprovalCount: 2,
            recentRuns: [
              {
                id: 'task-plan',
                goal: '先整理方案',
                status: 'waiting_interrupt',
                executionMode: 'plan',
                currentMinistry: 'gongbu-code',
                currentWorker: 'worker-gongbu',
                updatedAt: '2026-03-29T10:00:00.000Z',
                activeInterrupt: {
                  kind: 'user-input',
                  payload: { interactionKind: 'plan-question' }
                },
                planDraft: {
                  questionSet: {
                    title: '需要补充计划边界'
                  }
                }
              },
              {
                id: 'task-watchdog',
                goal: '终端执行卡住',
                status: 'waiting_approval',
                executionMode: 'execute',
                currentNode: 'runtime_governance_gate',
                currentMinistry: 'bingbu-ops',
                currentWorker: 'worker-bingbu',
                updatedAt: '2026-03-29T11:00:00.000Z',
                activeInterrupt: {
                  kind: 'runtime-governance',
                  payload: {
                    interactionKind: 'supplemental-input',
                    watchdog: true,
                    runtimeGovernanceReasonCode: 'watchdog_timeout'
                  }
                }
              }
            ],
            tools: {
              totalTools: 18,
              familyCount: 5,
              blockedToolCount: 2,
              approvalRequiredCount: 4,
              mcpBackedCount: 6,
              governanceToolCount: 3,
              families: [{ id: 'mcp', displayName: 'MCP', toolCount: 6 }],
              recentUsage: [
                {
                  toolName: 'github.search_code',
                  family: 'mcp',
                  status: 'blocked',
                  route: 'approval',
                  requestedBy: 'runtime',
                  usedAt: '2026-03-29T09:00:00.000Z',
                  blockedReason: '需要审批'
                }
              ],
              blockedReasons: [
                {
                  toolName: 'browser.open',
                  usedAt: '2026-03-29T09:00:00.000Z',
                  blockedReason: '缺少连接器授权',
                  riskLevel: 'high'
                }
              ],
              agentToolExecutions: {
                requests: [
                  {
                    id: 'req-approval',
                    taskId: 'task-approval',
                    toolName: 'browser.open',
                    nodeId: 'node-browser',
                    capabilityId: 'cap-browser-open',
                    status: 'pending_approval',
                    riskClass: 'high',
                    metadata: {
                      sandboxRunId: 'sandbox-runtime-1',
                      sandboxDecision: 'allow',
                      sandboxProfile: 'browser-only',
                      sandboxProviderId: 'browser-sandbox',
                      sandboxExitCode: '0',
                      autoReviewId: 'review-runtime-1',
                      autoReviewVerdict: 'approved',
                      autoReviewGateDecision: 'allow',
                      autoReviewReviewerKind: 'policy-reviewer',
                      rawInput: 'SECRET_RUNTIME_INPUT'
                    }
                  },
                  {
                    id: 'req-running',
                    taskId: 'task-running',
                    toolName: 'terminal.exec',
                    nodeId: 'node-terminal',
                    capabilityId: 'cap-terminal-exec',
                    status: 'running',
                    riskClass: 'critical'
                  },
                  {
                    id: 'req-success',
                    taskId: 'task-success',
                    toolName: 'github.search_code',
                    nodeId: 'node-mcp',
                    capabilityId: 'cap-github-search',
                    status: 'succeeded',
                    riskClass: 'medium'
                  }
                ],
                capabilities: [
                  {
                    id: 'cap-browser-open',
                    toolName: 'browser.open',
                    nodeId: 'node-browser',
                    displayName: 'Open browser',
                    riskClass: 'high',
                    requiresApproval: true
                  }
                ],
                nodes: [
                  {
                    id: 'node-browser',
                    displayName: 'Browser node',
                    status: 'available',
                    riskClass: 'high'
                  },
                  {
                    id: 'node-terminal',
                    displayName: 'Terminal node',
                    status: 'available',
                    riskClass: 'critical'
                  }
                ],
                policyDecisions: [
                  {
                    id: 'decision-approval',
                    requestId: 'req-approval',
                    decision: 'require_approval',
                    riskClass: 'high',
                    reason: '需要浏览器导航审批'
                  }
                ],
                events: [
                  {
                    id: 'event-blocked',
                    sessionId: 'session-1',
                    type: 'execution_step_blocked',
                    at: '2026-04-26T09:01:00.000Z',
                    payload: {
                      requestId: 'req-approval',
                      toolName: 'browser.open',
                      reasonCode: 'approval_required',
                      metadata: {
                        providerPayload: 'SECRET_RUNTIME_PROVIDER_PAYLOAD',
                        stdout: 'SECRET_RUNTIME_STDOUT',
                        stderr: 'SECRET_RUNTIME_STDERR'
                      }
                    }
                  },
                  {
                    id: 'event-resumed',
                    sessionId: 'session-1',
                    type: 'interrupt_resumed',
                    at: '2026-04-26T09:02:00.000Z',
                    payload: {
                      kind: 'tool_execution',
                      requestId: 'req-approval',
                      action: 'approve'
                    }
                  },
                  {
                    id: 'event-unknown',
                    sessionId: 'session-1',
                    type: 'unknown_agent_tool_event',
                    at: '2026-04-26T09:03:00.000Z',
                    payload: { requestId: 'req-ignored', toolName: 'ignored.tool' }
                  }
                ]
              }
            }
          } as any
        }
        executionModeFilter="all"
        onExecutionModeFilterChange={vi.fn()}
        interactionKindFilter="all"
        onInteractionKindFilterChange={vi.fn()}
        onCopyShareLink={vi.fn()}
      />
    );

    expect(html).toContain('Tool Governance');
    expect(html).toContain('司礼监中断与模式筛选');
    expect(html).toContain('需要补充计划边界');
    expect(html).toContain('运行时超时阻塞');
    expect(html).toContain('runtime-governance');
    expect(html).toContain('watchdog');
    expect(html).toContain('最近工具选路');
    expect(html).toContain('github.search_code');
    expect(html).toContain('当前阻塞原因');
    expect(html).toContain('缺少连接器授权');
    expect(html).toContain('Agent Tool Execution');
    expect(html).toContain('Requests');
    expect(html).toContain('pending approval 1');
    expect(html).toContain('running 1');
    expect(html).toContain('succeeded 1');
    expect(html).toContain('critical · 1');
    expect(html).toContain('terminal.exec');
    expect(html).toContain('pending_approval · high');
    expect(html).toContain('Browser node · 1');
    expect(html).toContain('require_approval');
    expect(html).toContain('需要浏览器导航审批');
    expect(html).toContain('blocked events 1');
    expect(html).toContain('resumed events 1');
    expect(html).toContain('审批已恢复');
    expect(html).toContain('req-approval');
    expect(html).toContain('sandbox sandbox-runtime-1');
    expect(html).toContain('sandbox decision allow');
    expect(html).toContain('sandbox profile browser-only');
    expect(html).toContain('sandbox provider browser-sandbox');
    expect(html).toContain('sandbox exit 0');
    expect(html).toContain('review review-runtime-1');
    expect(html).toContain('review verdict approved');
    expect(html).toContain('review gate allow');
    expect(html).toContain('reviewer policy-reviewer');
    expect(html).not.toContain('SECRET_RUNTIME_INPUT');
    expect(html).not.toContain('SECRET_RUNTIME_PROVIDER_PAYLOAD');
    expect(html).not.toContain('SECRET_RUNTIME_STDOUT');
    expect(html).not.toContain('SECRET_RUNTIME_STDERR');
    expect(html).not.toContain('ignored.tool');
  });

  it('renders explicit agent-tools projection when runtime tools omit embedded executions', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryTools
        runtime={
          {
            recentRuns: [],
            tools: {
              totalTools: 1,
              familyCount: 1,
              blockedToolCount: 0,
              approvalRequiredCount: 0,
              mcpBackedCount: 0,
              governanceToolCount: 0,
              families: [],
              recentUsage: [],
              blockedReasons: []
            }
          } as any
        }
        agentToolExecutions={{
          requests: [
            {
              id: 'req-projection',
              taskId: 'task-projection',
              toolName: 'terminal.exec',
              nodeId: 'node-projection',
              capabilityId: 'cap-terminal-exec',
              status: 'pending_approval',
              riskClass: 'critical'
            }
          ],
          capabilities: [
            {
              id: 'cap-terminal-exec',
              toolName: 'terminal.exec',
              nodeId: 'node-projection',
              displayName: 'Run command',
              riskClass: 'critical',
              requiresApproval: true
            }
          ],
          nodes: [
            {
              id: 'node-projection',
              displayName: 'Projection node',
              status: 'available',
              riskClass: 'critical'
            }
          ],
          policyDecisions: [
            {
              id: 'decision-projection',
              requestId: 'req-projection',
              decision: 'require_approval',
              riskClass: 'critical',
              reason: 'Projection policy'
            }
          ]
        }}
        executionModeFilter="all"
        onExecutionModeFilterChange={vi.fn()}
        interactionKindFilter="all"
        onInteractionKindFilterChange={vi.fn()}
        onCopyShareLink={vi.fn()}
      />
    );

    expect(html).toContain('Agent Tool Execution');
    expect(html).toContain('total 1');
    expect(html).toContain('pending approval 1');
    expect(html).toContain('critical · 1');
    expect(html).toContain('Projection node · 1');
    expect(html).toContain('Projection policy');
  });

  it('renders empty states when no matching interrupt or tool records exist', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryTools
        runtime={
          {
            recentRuns: [],
            tools: {
              totalTools: 0,
              familyCount: 0,
              blockedToolCount: 0,
              approvalRequiredCount: 0,
              mcpBackedCount: 0,
              governanceToolCount: 0,
              families: [],
              recentUsage: [],
              blockedReasons: []
            }
          } as any
        }
        executionModeFilter="plan"
        onExecutionModeFilterChange={vi.fn()}
        interactionKindFilter="approval"
        onInteractionKindFilterChange={vi.fn()}
        onCopyShareLink={vi.fn()}
      />
    );

    expect(html).toContain('当前没有 tool family 统计。');
    expect(html).toContain('当前筛选条件下没有匹配的交互中断任务。');
    expect(html).toContain('当前还没有工具使用记录。');
    expect(html).toContain('当前没有 tool governance 阻塞。');
  });

  it('routes filter buttons and share-link action through component callbacks', () => {
    const onExecutionModeFilterChange = vi.fn();
    const onInteractionKindFilterChange = vi.fn();
    const onCopyShareLink = vi.fn();

    renderToStaticMarkup(
      <RuntimeSummaryTools
        runtime={
          {
            recentRuns: [
              {
                id: 'task-plan',
                goal: '先整理方案',
                status: 'waiting_interrupt',
                executionMode: 'plan',
                updatedAt: '2026-03-29T10:00:00.000Z',
                activeInterrupt: {
                  kind: 'user-input',
                  payload: { interactionKind: 'plan-question' }
                },
                planDraft: {
                  questionSet: { title: '需要补充计划边界' }
                }
              }
            ],
            tools: {
              totalTools: 1,
              familyCount: 1,
              blockedToolCount: 0,
              approvalRequiredCount: 0,
              mcpBackedCount: 0,
              governanceToolCount: 0,
              families: [],
              recentUsage: [],
              blockedReasons: []
            }
          } as any
        }
        executionModeFilter="all"
        onExecutionModeFilterChange={onExecutionModeFilterChange}
        interactionKindFilter="all"
        onInteractionKindFilterChange={onInteractionKindFilterChange}
        onCopyShareLink={onCopyShareLink}
      />
    );

    renderedButtons.find(button => button.children === '复制视角链接')?.onClick?.();
    renderedButtons.find(button => button.children === '计划模式')?.onClick?.();
    renderedButtons.find(button => button.children === '执行模式')?.onClick?.();
    renderedButtons.find(button => button.children === '计划提问')?.onClick?.();
    renderedButtons.find(button => button.children === '补充输入')?.onClick?.();

    expect(onCopyShareLink).toHaveBeenCalled();
    expect(onExecutionModeFilterChange).toHaveBeenNthCalledWith(1, 'plan');
    expect(onExecutionModeFilterChange).toHaveBeenNthCalledWith(2, 'execute');
    expect(onInteractionKindFilterChange).toHaveBeenNthCalledWith(1, 'plan-question');
    expect(onInteractionKindFilterChange).toHaveBeenNthCalledWith(2, 'supplemental-input');
  });
});
