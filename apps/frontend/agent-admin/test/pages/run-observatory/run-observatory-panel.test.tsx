import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RunObservatoryPanel } from '@/pages/run-observatory/run-observatory-panel';

describe('RunObservatoryPanel', () => {
  it('renders header, timeline, trace, checkpoint, and diagnostics sections', () => {
    const html = renderToStaticMarkup(
      <RunObservatoryPanel
        loading={false}
        selectedTaskId="task-1"
        agentToolFilter="blocked"
        agentToolExecutions={{
          requests: [
            {
              requestId: 'req-1',
              taskId: 'task-1',
              toolName: 'terminal.exec',
              nodeId: 'worker-gongbu',
              status: 'pending_approval',
              riskClass: 'high',
              requestedAt: '2026-04-19T10:01:30.000Z'
            },
            {
              requestId: 'req-2',
              taskId: 'task-2',
              toolName: 'browser.open',
              status: 'running',
              riskClass: 'low',
              requestedAt: '2026-04-19T10:01:40.000Z'
            }
          ],
          results: [
            {
              resultId: 'result-1',
              requestId: 'req-1',
              status: 'failed',
              completedAt: '2026-04-19T10:02:30.000Z'
            }
          ],
          policyDecisions: [
            {
              decisionId: 'policy-1',
              requestId: 'req-1',
              decision: 'require_approval',
              riskClass: 'high',
              reason: 'shell write requires approval'
            }
          ],
          events: [
            {
              id: 'event-1',
              sessionId: 'session-1',
              type: 'execution_step_blocked',
              at: '2026-04-19T10:02:00.000Z',
              payload: {
                taskId: 'task-1',
                requestId: 'req-1',
                toolName: 'terminal.exec',
                nodeId: 'worker-gongbu',
                status: 'blocked',
                outputPreview: 'SECRET_VENDOR_PAYLOAD'
              }
            },
            {
              id: 'event-2',
              sessionId: 'session-1',
              type: 'execution_step_resumed',
              at: '2026-04-19T10:03:00.000Z',
              payload: {
                taskId: 'task-2',
                requestId: 'req-2',
                toolName: 'browser.open',
                status: 'resumed'
              }
            }
          ]
        }}
        focusTarget={{ kind: 'span', id: 'span-1' }}
        graphFilter={undefined}
        onGraphFilterChange={vi.fn()}
        onFocusTargetChange={vi.fn()}
        detail={{
          run: {
            taskId: 'task-1',
            goal: 'Diagnose execution regression',
            status: 'failed',
            startedAt: '2026-04-19T10:00:00.000Z',
            endedAt: '2026-04-19T10:03:00.000Z',
            durationMs: 180000,
            currentStage: 'interrupt',
            currentMinistry: 'gongbu',
            currentWorker: 'worker-1',
            hasInterrupt: true,
            hasFallback: true,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: false,
            diagnosticFlags: ['approval_blocked', 'fallback']
          },
          timeline: [
            {
              id: 'tl-1',
              stage: 'execution',
              status: 'failed',
              title: '工部/兵部执行',
              summary: '执行链路回退后失败',
              startedAt: '2026-04-19T10:01:00.000Z'
            }
          ],
          traces: [
            {
              spanId: 'span-1',
              node: 'gongbu_execute',
              stage: 'execution',
              status: 'failed',
              summary: '工部执行并触发回退',
              startedAt: '2026-04-19T10:01:00.000Z',
              latencyMs: 3200,
              modelUsed: 'gpt-5.4-mini',
              isFallback: true
            }
          ],
          checkpoints: [
            {
              checkpointId: 'cp-1',
              summary: '可从执行阶段恢复',
              createdAt: '2026-04-19T10:02:30.000Z',
              recoverable: true,
              recoverability: 'safe'
            }
          ],
          interrupts: [
            {
              id: 'interrupt-1',
              kind: 'approval',
              status: 'pending',
              title: '审批中断',
              summary: '等待人工确认后继续执行',
              createdAt: '2026-04-19T10:02:00.000Z',
              stage: 'interrupt',
              relatedCheckpointId: 'cp-1',
              relatedSpanId: 'span-1'
            }
          ],
          diagnostics: [
            {
              id: 'diag-1',
              kind: 'approval_blocked',
              severity: 'warning',
              title: '执行等待人工审批',
              summary: '当前 run 已进入中断态，等待人工确认后才能继续。',
              detectedAt: '2026-04-19T10:02:00.000Z',
              linkedCheckpointId: 'cp-1',
              linkedSpanId: 'span-1',
              linkedStage: 'interrupt'
            }
          ],
          artifacts: [],
          evidence: [
            {
              id: 'ev-1',
              title: 'CI Retry Storm',
              summary: 'CI log 指向重试风暴',
              sourceType: 'runtime-log',
              trustLevel: 'high',
              stage: 'execution',
              linkedCheckpointId: 'cp-1',
              linkedSpanId: 'span-1'
            }
          ]
        }}
      />
    );

    expect(html).toContain('Execution Observatory');
    expect(html).toContain('Stage Timeline');
    expect(html).toContain('Focused Context');
    expect(html).toContain('Trace Waterfall');
    expect(html).toContain('Checkpoint Replay');
    expect(html).toContain('Interrupt Ledger');
    expect(html).toContain('Evidence');
    expect(html).toContain('Diagnostics');
    expect(html).toContain('gpt-5.4-mini');
    expect(html).toContain('recoverable');
    expect(html).toContain('CI Retry Storm');
    expect(html).toContain('等待人工确认后继续执行');
    expect(html).toContain('checkpoint cp-1');
    expect(html).toContain('span span-1');
    expect(html).toContain('Span gongbu_execute');
    expect(html).toContain('interrupts 1');
    expect(html).toContain('evidence CI Retry Storm');
    expect(html).toContain('Agent Tool Observatory');
    expect(html).toContain('requests 1');
    expect(html).toContain('results 1');
    expect(html).toContain('events 1');
    expect(html).toContain('policy 1');
    expect(html).toContain('terminal.exec');
    expect(html).toContain('execution_step_blocked');
    expect(html).toContain('pending_approval · risk high · worker-gongbu');
    expect(html).not.toContain('browser.open');
    expect(html).not.toContain('SECRET_VENDOR_PAYLOAD');
  });

  it('filters observability sections by graph node filter', () => {
    const html = renderToStaticMarkup(
      <RunObservatoryPanel
        loading={false}
        selectedTaskId="task-1"
        focusTarget={undefined}
        graphFilter={{
          nodeId: 'worker-gongbu',
          label: 'gongbu_execute',
          stages: ['execution'],
          spanIds: ['span-1'],
          checkpointIds: ['cp-1'],
          evidenceIds: ['ev-1'],
          diagnosticIds: ['diag-1'],
          interruptIds: []
        }}
        onGraphFilterChange={vi.fn()}
        onFocusTargetChange={vi.fn()}
        detail={{
          run: {
            taskId: 'task-1',
            goal: 'Diagnose execution regression',
            status: 'failed',
            startedAt: '2026-04-19T10:00:00.000Z',
            currentStage: 'interrupt',
            hasInterrupt: true,
            hasFallback: true,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: false,
            diagnosticFlags: ['approval_blocked', 'fallback']
          },
          timeline: [
            {
              id: 'tl-1',
              stage: 'execution',
              status: 'failed',
              title: '工部/兵部执行',
              summary: '执行链路回退后失败'
            },
            {
              id: 'tl-2',
              stage: 'review',
              status: 'completed',
              title: '刑部复核',
              summary: 'review completed'
            }
          ],
          traces: [
            {
              spanId: 'span-1',
              node: 'gongbu_execute',
              stage: 'execution',
              status: 'failed',
              summary: '工部执行并触发回退',
              startedAt: '2026-04-19T10:01:00.000Z'
            },
            {
              spanId: 'span-2',
              node: 'xingbu_review',
              stage: 'review',
              status: 'completed',
              summary: '刑部复核完成',
              startedAt: '2026-04-19T10:02:00.000Z'
            }
          ],
          checkpoints: [
            {
              checkpointId: 'cp-1',
              summary: '可从执行阶段恢复',
              createdAt: '2026-04-19T10:02:30.000Z',
              recoverable: true,
              recoverability: 'safe',
              stage: 'execution'
            },
            {
              checkpointId: 'cp-2',
              summary: 'review checkpoint',
              createdAt: '2026-04-19T10:03:00.000Z',
              recoverable: true,
              recoverability: 'partial',
              stage: 'review'
            }
          ],
          interrupts: [],
          diagnostics: [
            {
              id: 'diag-1',
              kind: 'approval_blocked',
              severity: 'warning',
              title: '执行等待人工审批',
              summary: '当前 run 已进入中断态，等待人工确认后才能继续。',
              detectedAt: '2026-04-19T10:02:00.000Z',
              linkedCheckpointId: 'cp-1',
              linkedSpanId: 'span-1',
              linkedStage: 'execution'
            },
            {
              id: 'diag-2',
              kind: 'fallback',
              severity: 'warning',
              title: 'review fallback',
              summary: 'review fallback summary',
              detectedAt: '2026-04-19T10:03:30.000Z',
              linkedCheckpointId: 'cp-2',
              linkedSpanId: 'span-2',
              linkedStage: 'review'
            }
          ],
          artifacts: [],
          evidence: [
            {
              id: 'ev-1',
              title: 'CI Retry Storm',
              summary: 'CI log 指向重试风暴',
              sourceType: 'runtime-log',
              trustLevel: 'high',
              stage: 'execution',
              linkedCheckpointId: 'cp-1',
              linkedSpanId: 'span-1'
            },
            {
              id: 'ev-2',
              title: 'Review Notes',
              summary: 'review evidence',
              sourceType: 'doc',
              trustLevel: 'medium',
              stage: 'review',
              linkedCheckpointId: 'cp-2',
              linkedSpanId: 'span-2'
            }
          ]
        }}
      />
    );

    expect(html).toContain('节点过滤 gongbu_execute');
    expect(html).toContain('gongbu_execute');
    expect(html).toContain('CI Retry Storm');
    expect(html).toContain('可从执行阶段恢复');
    expect(html).toContain('执行等待人工审批');
    expect(html).not.toContain('xingbu_review');
    expect(html).not.toContain('Review Notes');
    expect(html).not.toContain('review checkpoint');
  });
});
