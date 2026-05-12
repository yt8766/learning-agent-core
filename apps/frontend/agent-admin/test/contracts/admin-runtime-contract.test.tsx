import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ArchiveCenterPanel } from '@/pages/archive-center/archive-center-panel';
import { EvidenceCenterPanel } from '@/pages/evidence-center/evidence-center-panel';
import { RuntimeSummaryOverview } from '@/pages/runtime-overview/components/runtime-summary-overview';
import { RuntimeSummaryVisuals } from '@/pages/runtime-overview/components/runtime-summary-visuals';

describe('agent-admin runtime contract smoke', () => {
  it('renders runtime overview, evidence checkpoint replay, and archive export summary from canonical shapes', () => {
    const runtimeHtml = renderToStaticMarkup(
      <RuntimeSummaryOverview
        runtime={
          {
            runtimeProfile: 'platform',
            activeTaskCount: 2,
            taskCount: 8,
            queueDepth: 1,
            blockedRunCount: 0,
            budgetExceededCount: 0,
            pendingApprovalCount: 1,
            activeSessionCount: 2,
            sessionCount: 4,
            interruptTimeoutCount: 0,
            waitingInterruptAverageMinutes: 0,
            recentAgentErrors: [
              {
                taskId: 'task-1',
                ministry: 'gongbu-code',
                errorCode: 'provider_timeout',
                message: 'provider timeout'
              }
            ],
            diagnosisEvidenceCount: 1,
            activeMinistries: ['gongbu-code'],
            activeWorkers: ['gongbu-code'],
            recentRuns: [
              {
                id: 'task-1',
                streamStatus: {
                  nodeId: 'context_filter',
                  nodeLabel: '文书科',
                  detail: '正在压缩历史上下文并整理给工部',
                  progressPercent: 45,
                  updatedAt: '2026-03-31T00:00:00.000Z'
                },
                contextFilterState: {
                  filteredContextSlice: {
                    summary: '已过滤系统战报与无关历史',
                    compressionApplied: true,
                    compressionSource: 'llm',
                    compressedMessageCount: 12
                  }
                }
              }
            ],
            backgroundRunCount: 1,
            foregroundRunCount: 1,
            leasedBackgroundRunCount: 1,
            staleLeaseCount: 0,
            activeWorkerSlotCount: 1,
            workerPoolSize: 4,
            availableWorkerSlotCount: 3,
            policy: {
              approvalMode: 'balanced',
              skillInstallMode: 'manual',
              learningMode: 'governed',
              sourcePolicyMode: 'controlled-first',
              budget: { stepBudget: 10, retryBudget: 2, sourceBudget: 5 }
            },
            subgraphs: [],
            workflowVersions: []
          } as any
        }
      />
    );

    const visualsHtml = renderToStaticMarkup(
      <RuntimeSummaryVisuals
        runtime={
          {
            imperialChain: [
              {
                taskId: 'task-1',
                goal: '整理运行纪律',
                node: 'result_aggregator',
                modeGateState: { activeMode: 'execute', reason: '已进入执行态' },
                contextFilterState: {
                  filteredContextSlice: {
                    summary: '已过滤系统战报与无关历史',
                    historyTraceCount: 4,
                    compressionApplied: true,
                    compressionSource: 'llm',
                    compressedMessageCount: 12
                  },
                  audienceSlices: {
                    strategy: { summary: '先整理策略约束', dispatchCount: 1 },
                    ministry: { summary: '再派工部执行', dispatchCount: 1 },
                    fallback: { summary: '当前无需通才兜底', dispatchCount: 0 }
                  }
                },
                finalReviewState: {
                  decision: 'pass',
                  summary: '终审通过',
                  interruptRequired: false,
                  deliveryStatus: 'delivered',
                  deliveryMinistry: 'libu-delivery'
                },
                dispatches: [
                  {
                    taskId: 'task-1',
                    subTaskId: 'sub-1',
                    from: 'manager',
                    to: 'research',
                    kind: 'strategy',
                    objective: '先整理策略约束'
                  }
                ],
                governanceScore: {
                  ministry: 'libu-governance',
                  score: 88,
                  status: 'healthy',
                  summary: '治理评分稳定。',
                  trustAdjustment: 'promote'
                },
                streamStatus: {
                  nodeId: 'context_filter',
                  nodeLabel: '文书科',
                  detail: '正在压缩历史上下文并整理给工部',
                  progressPercent: 45,
                  updatedAt: '2026-03-31T00:00:00.000Z'
                }
              }
            ],
            executionSpans: [
              {
                taskId: 'task-1',
                ministries: ['工部', '兵部'],
                currentMinistry: 'gongbu-code',
                microLoopCount: 1,
                maxMicroLoops: 2,
                microLoopState: {
                  state: 'retrying',
                  attempt: 1,
                  maxAttempts: 2,
                  updatedAt: '2026-03-31T00:00:00.000Z'
                },
                dispatchKinds: ['strategy', 'ministry']
              }
            ],
            interruptLedger: [{ taskId: 'task-1', interruptHistory: [] }],
            thoughtGraphs: [],
            modelHeatmap: [],
            strategyCounselors: [
              {
                taskId: 'task-1',
                goal: '整理运行纪律',
                counselors: [{ id: 'risk-compliance', displayName: '风控合规阁臣' }]
              }
            ],
            plannerStrategies: [
              {
                taskId: 'task-1',
                goal: '整理运行纪律',
                strategy: {
                  mode: 'capability-gap',
                  summary: '当前尚未命中官方 Agent，需要先确认能力缺口与替代路径。',
                  leadDomain: 'risk-compliance',
                  requiredCapabilities: ['specialist.risk-compliance'],
                  candidateAgentIds: [],
                  candidateCount: 0,
                  gapDetected: true
                }
              }
            ],
            libuScorecards: [{ taskId: 'task-1', summary: '吏部已完成评分摘要。' }],
            governanceScorecards: [
              {
                taskId: 'task-1',
                score: 88,
                status: 'healthy',
                summary: '治理评分稳定。',
                trustAdjustment: 'promote',
                recommendedLearningTargets: ['memory']
              }
            ]
          } as any
        }
        onSelectTask={vi.fn()}
      />
    );

    const evidenceHtml = renderToStaticMarkup(
      <EvidenceCenterPanel
        evidence={[
          {
            id: 'e-1',
            sourceType: 'diagnosis_result',
            summary: '发现 provider timeout 根因',
            taskGoal: '分析中断问题',
            trustClass: 'high',
            createdAt: '2026-03-31T00:00:00.000Z',
            detail: {
              executionSummary: '已完成诊断',
              finalAnswer: '建议启用 checkpoint fallback'
            },
            recoverable: true,
            checkpointRef: {
              sessionId: 'session-1',
              checkpointId: 'cp-1',
              checkpointCursor: 7,
              recoverability: 'safe'
            }
          } as any
        ]}
      />
    );

    const archiveHtml = renderToStaticMarkup(
      <ArchiveCenterPanel
        runtime={
          {
            usageAnalytics: {
              historyDays: 30,
              persistedDailyHistory: [],
              recentUsageAudit: [],
              historyRange: {
                earliestDay: '2026-03-01',
                latestDay: '2026-03-31'
              }
            }
          } as any
        }
        evals={
          {
            historyDays: 30,
            persistedDailyHistory: [],
            recentRuns: []
          } as any
        }
        runtimeHistoryDays={30}
        evalsHistoryDays={30}
        runtimeExportFilters={{ executionMode: 'plan', interactionKind: 'plan-question' }}
        approvalsExportFilters={{ executionMode: 'plan', interactionKind: 'plan-question' }}
        onRuntimeHistoryDaysChange={vi.fn()}
        onEvalsHistoryDaysChange={vi.fn()}
        onExportRuntime={vi.fn()}
        onExportApprovals={vi.fn()}
        onExportEvals={vi.fn()}
      />
    );

    expect(runtimeHtml).toContain('Runtime Policy');
    expect(runtimeHtml).toContain('controlled-first');
    expect(runtimeHtml).toContain('provider timeout');
    expect(visualsHtml).toContain('票拟分发');
    expect(visualsHtml).toContain('治理评分稳定');
    expect(visualsHtml).toContain('capability-gap');
    expect(visualsHtml).toContain('specialist.risk-compliance');
    expect(visualsHtml).toContain('分发类型');
    expect(visualsHtml).toContain('微循环状态');
    expect(visualsHtml).toContain('交付 delivered');
    expect(visualsHtml).toContain('受众切片');
    expect(runtimeHtml).toContain('当前节点战报');
    expect(runtimeHtml).toContain('文书科');
    expect(runtimeHtml).toContain('正在压缩历史上下文并整理给工部');
    expect(runtimeHtml).not.toContain('Daily Tech Briefing');

    expect(evidenceHtml).toContain('检查点回放');
    expect(evidenceHtml).toContain('cp-1');
    expect(evidenceHtml).toContain('cursor 7');

    expect(archiveHtml).toContain('运行归档');
    expect(archiveHtml).toContain('执行模式 计划模式');
    expect(archiveHtml).toContain('交互类型 plan-question');
  });
});
