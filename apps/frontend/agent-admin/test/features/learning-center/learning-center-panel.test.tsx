import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const learningCenterTestState = vi.hoisted(() => ({
  renderedButtons: [] as Array<{ children?: unknown; onClick?: () => void }>,
  renderedInputs: [] as Array<{
    placeholder?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }>,
  stateQueue: [] as Array<[unknown, ReturnType<typeof vi.fn>]>
}));

function getButtonText(children: unknown): string {
  if (Array.isArray(children)) {
    return children.map(getButtonText).join('');
  }
  if (children === null || children === undefined || typeof children === 'boolean') {
    return '';
  }
  return String(children);
}

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initialValue: unknown) => {
      if (learningCenterTestState.stateQueue.length > 0) {
        return learningCenterTestState.stateQueue.shift()!;
      }
      return [initialValue, vi.fn()];
    }) as unknown as typeof actual.useState
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void }) => {
    learningCenterTestState.renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    placeholder,
    onChange
  }: {
    placeholder?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }) => {
    learningCenterTestState.renderedInputs.push({ placeholder, onChange });
    return <input />;
  }
}));

import { LearningCenterPanel } from '@/features/learning-center/learning-center-panel';
import type { LearningCenterRecord } from '@/types/admin';

describe('LearningCenterPanel render smoke', () => {
  beforeEach(() => {
    learningCenterTestState.renderedButtons.length = 0;
    learningCenterTestState.renderedInputs.length = 0;
    learningCenterTestState.stateQueue.length = 0;
  });

  it('renders learning candidate governance metadata and recent job signals', () => {
    const learning: LearningCenterRecord = {
      totalCandidates: 1,
      pendingCandidates: 1,
      confirmedCandidates: 0,
      researchJobs: 1,
      averageEvaluationScore: 94,
      autoConfirmableCandidates: 1,
      autoPersistedResearchJobs: 1,
      conflictingResearchJobs: 1,
      invalidatedMemories: 0,
      quarantinedMemories: 1,
      invalidatedRules: 0,
      quarantineCategoryStats: {
        runtime_noise: 1
      },
      quarantineRestoreSuggestions: ['清理运行态污染后再恢复。'],
      counselorSelectorConfigs: [
        {
          selectorId: 'payment-selector-v2',
          domain: 'payment',
          enabled: true,
          strategy: 'session-ratio',
          candidateIds: ['payment-counselor-v1', 'payment-counselor-v2'],
          weights: [1, 3],
          featureFlag: 'payment_rollout',
          defaultCounselorId: 'payment-counselor-v1',
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      learningConflictScan: {
        scannedAt: '2026-03-22T00:00:00.000Z',
        conflictPairs: [
          {
            id: 'conflict-payment',
            contextSignature: 'ctx-payment',
            memoryIds: ['mem-a', 'mem-b'],
            recommendation: 'lightweight_review_required',
            riskLevel: 'medium',
            effectivenessSpread: 0.08,
            status: 'open'
          }
        ],
        mergeSuggestions: [
          {
            conflictId: 'conflict-payment',
            preferredMemoryId: 'mem-a',
            loserMemoryIds: ['mem-b'],
            suggestion: 'Prefer mem-a and retire mem-b.'
          }
        ],
        manualReviewQueue: [
          {
            id: 'conflict-payment',
            contextSignature: 'ctx-payment',
            memoryIds: ['mem-a', 'mem-b'],
            severity: 'medium',
            resolution: 'lightweight_review_required',
            preferredMemoryId: 'mem-a',
            effectivenessSpread: 0.08,
            status: 'open'
          }
        ]
      },
      knowledgeStores: {
        wenyuan: {
          memoryCount: 3,
          sessionCount: 2,
          checkpointCount: 2,
          traceCount: 7,
          governanceHistoryCount: 4
        },
        cangjing: {
          sourceCount: 5,
          chunkCount: 9,
          embeddingCount: 7,
          searchableDocumentCount: 4,
          blockedDocumentCount: 1,
          latestReceiptIds: ['receipt-1']
        }
      },
      recentGovernanceReports: [
        {
          taskId: 'task-1',
          summary: '治理链认为可继续提升信任。',
          reviewDecision: 'pass',
          evidenceScore: 87,
          sandboxScore: 90,
          trustAdjustment: 'promote'
        }
      ],
      capabilityTrustProfiles: [
        {
          capabilityId: 'skill-product-review',
          displayName: 'Product Review',
          trustLevel: 'high',
          trustTrend: 'up',
          reportCount: 3,
          promoteCount: 2,
          holdCount: 1,
          downgradeCount: 0,
          lastTaskId: 'task-1',
          lastReviewDecision: 'pass',
          lastReason: '终审通过。',
          updatedAt: '2026-03-28T00:20:00.000Z'
        }
      ],
      ministryGovernanceProfiles: [
        {
          entityId: 'hubu-search',
          displayName: 'hubu-search',
          entityKind: 'ministry',
          trustLevel: 'high',
          trustTrend: 'up',
          reportCount: 4,
          promoteCount: 3,
          holdCount: 1,
          downgradeCount: 0,
          lastTaskId: 'task-1',
          lastReviewDecision: 'pass',
          lastReason: '终审通过。',
          updatedAt: '2026-03-28T00:20:00.000Z'
        }
      ],
      workerGovernanceProfiles: [
        {
          entityId: 'gongbu-code-frontend',
          displayName: '工部前端营造官',
          entityKind: 'worker',
          trustLevel: 'high',
          trustTrend: 'up',
          reportCount: 2,
          promoteCount: 2,
          holdCount: 0,
          downgradeCount: 0,
          lastTaskId: 'task-1',
          lastReviewDecision: 'pass',
          lastReason: '终审通过。',
          updatedAt: '2026-03-28T00:20:00.000Z'
        }
      ],
      specialistGovernanceProfiles: [
        {
          entityId: 'product-strategy',
          displayName: '产品策略',
          entityKind: 'specialist',
          trustLevel: 'medium',
          trustTrend: 'steady',
          reportCount: 1,
          promoteCount: 0,
          holdCount: 1,
          downgradeCount: 0,
          lastTaskId: 'task-1',
          lastReviewDecision: 'pass',
          lastReason: '终审通过。',
          updatedAt: '2026-03-28T00:20:00.000Z'
        }
      ],
      recentCrossCheckEvidence: [
        {
          memoryId: 'mem-quarantine-1',
          id: 'official-rule:runtime-noise',
          summary: '运行态污染规则交叉校验',
          sourceType: 'official_rule',
          trustClass: 'official'
        }
      ],
      recentQuarantinedMemories: [
        {
          id: 'mem-quarantine-1',
          summary: '被运行态污染的经验',
          quarantineReason: 'contains runtime noise',
          quarantineCategory: 'runtime_noise',
          quarantineReasonDetail: 'Matched suspicious runtime artifact token "礼部".',
          quarantineRestoreSuggestion: '清理运行态污染后再恢复。',
          quarantinedAt: '2026-03-28T01:00:00.000Z'
        }
      ],
      recentSkillGovernance: [
        {
          taskId: 'task-1',
          goal: '给出更专业的产品建议',
          skillId: 'skill-product-review',
          recommendation: 'keep-lab',
          successRate: 0.82,
          updatedAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      candidates: [
        {
          id: 'candidate-1',
          taskId: 'task-1',
          taskGoal: '给出更专业的产品建议',
          type: 'memory',
          summary: '用户偏好主聊天区只显示最终答复',
          status: 'pending_confirmation',
          currentMinistry: 'libu',
          currentWorker: 'learning-flow',
          confidenceScore: 92,
          autoConfirmEligible: true,
          provenanceCount: 2,
          evaluationScore: 94,
          evaluationConfidence: 'high',
          candidateReasons: ['基于用户稳定表达提取到输出风格偏好'],
          skippedReasons: ['单次临时要求未进入长期记忆'],
          conflictDetected: true,
          conflictTargets: ['mem_pref_output_style'],
          derivedFromLayers: ['session-compression'],
          policyMode: 'profile:personal',
          expertiseSignals: ['domain-expert'],
          createdAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      recentJobs: [
        {
          id: 'job-1',
          sourceType: 'research',
          status: 'completed',
          documentUri: 'local://notes',
          goal: '补齐 skill gap',
          summary: '主动补齐能力缺口',
          sourceCount: 2,
          evaluationScore: 96,
          evaluationConfidence: 'high',
          candidateReasons: ['基于历史经验补齐能力缺口'],
          skippedReasons: ['低价值片段未沉淀'],
          expertiseSignals: ['testing-expert'],
          autoPersistEligible: true,
          persistedMemoryIds: ['mem-1'],
          conflictDetected: true,
          conflictNotes: ['存在相近旧经验，需谨慎覆盖'],
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      learningQueueSummary: {
        queued: 2,
        processing: 1,
        blocked: 0,
        completed: 3,
        taskLearningQueued: 1,
        dreamTaskQueued: 1,
        dreamTaskCompleted: 2
      },
      learningQueue: [
        {
          id: 'queue-1',
          taskId: 'task-1',
          status: 'queued',
          mode: 'task-learning',
          queuedAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z',
          priority: 'high',
          capabilityUsageStats: {
            toolCount: 3,
            workerCount: 1,
            totalTokens: 1200
          }
        },
        {
          id: 'dream-1',
          taskId: 'task-1',
          status: 'completed',
          mode: 'dream-task',
          summary: '整理用户偏好与成功案例',
          candidateSummary: 'memory 1 / rule 1 / skill 0',
          queuedAt: '2026-03-22T00:10:00.000Z',
          updatedAt: '2026-03-22T00:20:00.000Z',
          finishedAt: '2026-03-22T00:20:00.000Z',
          priority: 'normal',
          capabilityUsageStats: {
            toolCount: 1,
            workerCount: 1
          }
        }
      ]
    };

    const html = renderToStaticMarkup(
      <LearningCenterPanel
        learning={learning}
        loading={false}
        onInvalidateMemory={vi.fn()}
        onSupersedeMemory={vi.fn()}
        onRestoreMemory={vi.fn()}
        onRetireMemory={vi.fn()}
        onCreateCounselorSelector={vi.fn()}
        onEditCounselorSelector={vi.fn()}
        onEnableCounselorSelector={vi.fn()}
        onDisableCounselorSelector={vi.fn()}
        onSetLearningConflictStatus={vi.fn()}
      />
    );

    expect(html).toContain('Learning Candidates');
    expect(html).toContain('用户偏好主聊天区只显示最终答复');
    expect(html).toContain('profile:personal');
    expect(html).toContain('domain-expert');
    expect(html).toContain('mem_pref_output_style');
    expect(html).toContain('session-compression');
    expect(html).toContain('Quarantined Memories');
    expect(html).toContain('Quarantine Governance');
    expect(html).toContain('运行态污染规则交叉校验');
    expect(html).toContain('official_rule');
    expect(html).toContain('official');
    expect(html).toContain('contains runtime noise');
    expect(html).toContain('runtime_noise');
    expect(html).toContain('Matched suspicious runtime artifact token');
    expect(html).toContain('清理运行态污染后再恢复');
    expect(html).toContain('mem-quarantine-1');
    expect(html).toContain('Recent Research Jobs');
    expect(html).toContain('testing-expert');
    expect(html).toContain('mem-1');
    expect(html).toContain('skill-product-review');
    expect(html).toContain('payment-selector-v2');
    expect(html).toContain('payment_rollout');
    expect(html).toContain('conflict-payment');
    expect(html).toContain('dream-task queued 1');
    expect(html).toContain('dream-task');
    expect(html).toContain('整理用户偏好与成功案例');
    expect(html).toContain('仅整理候选，不会自动发布 stable skill');
    expect(html).toContain('Learning Queue Structure');
    expect(html).toContain('Queue');
    expect(html).toContain('Conflict');
    expect(html).toContain('Ministry');
    expect(html).toContain('Trust');
    expect(html).toContain('Wenyuan / Cangjing');
    expect(html).toContain('文渊阁');
    expect(html).toContain('藏经阁');
    expect(html).toContain('Governance Reports');
    expect(html).toContain('Capability Trust');
    expect(html).toContain('Ministry Governance');
    expect(html).toContain('Worker Governance');
    expect(html).toContain('Specialist Governance');
    expect(html).toContain('skill-product-review');
    expect(html).toContain('gongbu-code-frontend');
    expect(html).toContain('product-strategy');
    expect(html).toContain('3 reports');
    expect(html).toContain('promote 2 / hold 1 / downgrade 0');
  });

  it('routes selector, conflict, memory and chart actions through callbacks', () => {
    const setActiveChart = vi.fn();
    const setSelectorDomainFilter = vi.fn();
    const setSelectorFeatureFlagFilter = vi.fn();
    const onInvalidateMemory = vi.fn();
    const onSupersedeMemory = vi.fn();
    const onRestoreMemory = vi.fn();
    const onRetireMemory = vi.fn();
    const onCreateCounselorSelector = vi.fn();
    const onEditCounselorSelector = vi.fn();
    const onEnableCounselorSelector = vi.fn();
    const onDisableCounselorSelector = vi.fn();
    const onSetLearningConflictStatus = vi.fn();

    learningCenterTestState.stateQueue.push(
      ['queue', setActiveChart],
      ['', setSelectorDomainFilter],
      ['', setSelectorFeatureFlagFilter]
    );

    renderToStaticMarkup(
      <LearningCenterPanel
        learning={
          {
            totalCandidates: 1,
            pendingCandidates: 1,
            confirmedCandidates: 0,
            researchJobs: 1,
            averageEvaluationScore: 94,
            autoConfirmableCandidates: 1,
            autoPersistedResearchJobs: 1,
            conflictingResearchJobs: 1,
            invalidatedMemories: 0,
            quarantinedMemories: 0,
            invalidatedRules: 0,
            candidates: [],
            recentGovernanceReports: [],
            capabilityTrustProfiles: [{ capabilityId: 'cap-1', displayName: 'Cap', trustLevel: 'high' }],
            ministryGovernanceProfiles: [],
            workerGovernanceProfiles: [],
            specialistGovernanceProfiles: [],
            counselorSelectorConfigs: [
              {
                selectorId: 'selector-enabled',
                domain: 'payment',
                enabled: true,
                strategy: 'session-ratio',
                candidateIds: ['c1'],
                weights: [1],
                featureFlag: 'payment_rollout',
                defaultCounselorId: 'c1',
                createdAt: '2026-03-22T00:00:00.000Z',
                updatedAt: '2026-03-22T00:00:00.000Z'
              },
              {
                selectorId: 'selector-disabled',
                domain: 'support',
                enabled: false,
                strategy: 'sticky',
                candidateIds: ['c2'],
                weights: [1],
                defaultCounselorId: 'c2',
                createdAt: '2026-03-22T00:00:00.000Z',
                updatedAt: '2026-03-22T00:00:00.000Z'
              }
            ],
            learningConflictScan: {
              scannedAt: '2026-03-22T00:00:00.000Z',
              conflictPairs: [
                {
                  id: 'conflict-open',
                  contextSignature: 'ctx-payment',
                  memoryIds: ['mem-a', 'mem-b'],
                  recommendation: 'lightweight_review_required',
                  riskLevel: 'medium',
                  effectivenessSpread: 0.08,
                  status: 'open'
                }
              ],
              mergeSuggestions: [
                {
                  conflictId: 'conflict-merge',
                  preferredMemoryId: 'mem-a',
                  loserMemoryIds: ['mem-b'],
                  suggestion: 'Prefer mem-a and retire mem-b.'
                }
              ],
              manualReviewQueue: [
                {
                  id: 'conflict-manual',
                  contextSignature: 'ctx-manual',
                  memoryIds: ['mem-x', 'mem-y'],
                  severity: 'medium',
                  resolution: 'lightweight_review_required',
                  preferredMemoryId: 'mem-x',
                  effectivenessSpread: 0.06,
                  status: 'open'
                }
              ]
            },
            learningQueueSummary: {
              queued: 1,
              processing: 0,
              blocked: 0,
              completed: 1,
              taskLearningQueued: 1,
              dreamTaskQueued: 0,
              dreamTaskCompleted: 1
            },
            learningQueue: [],
            counselorExperiments: [],
            recentJobs: [
              {
                id: 'job-1',
                sourceType: 'research',
                status: 'completed',
                goal: '补齐 skill gap',
                summary: '主动补齐能力缺口',
                persistedMemoryIds: ['mem-1'],
                updatedAt: '2026-03-22T00:00:00.000Z'
              }
            ],
            ministryScorecards: [{ ministry: 'hubu', averageScore: 92, reportCount: 2 }],
            knowledgeStores: {},
            conflictGovernance: { open: 1, merged: 0, dismissed: 0, escalated: 0 },
            budgetEfficiencyWarnings: [],
            quarantineCategoryStats: {},
            quarantineRestoreSuggestions: [],
            recentCrossCheckEvidence: [],
            recentQuarantinedMemories: [],
            recentSkillGovernance: []
          } as any
        }
        loading={false}
        onInvalidateMemory={onInvalidateMemory}
        onSupersedeMemory={onSupersedeMemory}
        onRestoreMemory={onRestoreMemory}
        onRetireMemory={onRetireMemory}
        onCreateCounselorSelector={onCreateCounselorSelector}
        onEditCounselorSelector={onEditCounselorSelector}
        onEnableCounselorSelector={onEnableCounselorSelector}
        onDisableCounselorSelector={onDisableCounselorSelector}
        onSetLearningConflictStatus={onSetLearningConflictStatus}
      />
    );

    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '新建 selector')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '编辑')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '停用')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '启用')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '接受合并建议')?.onClick?.();
    learningCenterTestState.renderedButtons.filter(item => getButtonText(item.children) === '升级处理')[0]?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '挂起')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '重新打开')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '标记已完成')?.onClick?.();
    learningCenterTestState.renderedButtons.filter(item => getButtonText(item.children) === '升级')[0]?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '失效')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '替代')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '恢复')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === '归档')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === 'Conflict')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === 'Ministry')?.onClick?.();
    learningCenterTestState.renderedButtons.find(item => getButtonText(item.children) === 'Trust')?.onClick?.();
    learningCenterTestState.renderedInputs
      .find(item => item.placeholder === '按 domain 过滤')
      ?.onChange?.({ target: { value: 'payment' } });
    learningCenterTestState.renderedInputs
      .find(item => item.placeholder === '按 feature flag 过滤')
      ?.onChange?.({ target: { value: 'rollout' } });

    expect(onCreateCounselorSelector).toHaveBeenCalledTimes(1);
    expect(onEditCounselorSelector).toHaveBeenCalledWith(expect.objectContaining({ selectorId: 'selector-enabled' }));
    expect(onDisableCounselorSelector).toHaveBeenCalledWith('selector-enabled');
    expect(onEnableCounselorSelector).toHaveBeenCalledWith('selector-disabled');
    expect(onSetLearningConflictStatus).toHaveBeenNthCalledWith(1, 'conflict-merge', 'merged', 'mem-a');
    expect(onSetLearningConflictStatus).toHaveBeenNthCalledWith(2, 'conflict-merge', 'escalated', 'mem-a');
    expect(onSetLearningConflictStatus).toHaveBeenNthCalledWith(3, 'conflict-open', 'dismissed');
    expect(onSetLearningConflictStatus).toHaveBeenNthCalledWith(4, 'conflict-open', 'open');
    expect(onSetLearningConflictStatus).toHaveBeenNthCalledWith(5, 'conflict-manual', 'merged', 'mem-x');
    expect(onSetLearningConflictStatus).toHaveBeenNthCalledWith(6, 'conflict-manual', 'escalated', 'mem-x');
    expect(onInvalidateMemory).toHaveBeenCalledWith('mem-1');
    expect(onSupersedeMemory).toHaveBeenCalledWith('mem-1');
    expect(onRestoreMemory).toHaveBeenCalledWith('mem-1');
    expect(onRetireMemory).toHaveBeenCalledWith('mem-1');
    expect(setActiveChart).toHaveBeenNthCalledWith(1, 'conflict');
    expect(setActiveChart).toHaveBeenNthCalledWith(2, 'ministry');
    expect(setActiveChart).toHaveBeenNthCalledWith(3, 'trust');
    expect(setSelectorDomainFilter).toHaveBeenCalledWith('payment');
    expect(setSelectorFeatureFlagFilter).toHaveBeenCalledWith('rollout');
  });
});
