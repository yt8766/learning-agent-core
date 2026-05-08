import { describe, expect, it, vi } from 'vitest';

import { collaborators, createService } from './runtime.service.test-helpers';

describe('RuntimeService learning centers', () => {
  it('learning center 会为重复诊断错误生成待确认规则候选', async () => {
    const service = createService();
    collaborators(service).orchestrator.listTasks.mockReturnValue([
      {
        id: 'task-rule-1',
        goal: '修复 pnpm 安装失败',
        status: 'failed',
        currentMinistry: 'bingbu-ops',
        currentWorker: 'bingbu-worker',
        connectorRefs: [],
        approvals: [],
        messages: [],
        agentStates: [],
        createdAt: '2026-03-27T08:00:00.000Z',
        updatedAt: '2026-03-27T08:10:00.000Z',
        externalSources: [
          {
            id: 'diag-1',
            taskId: 'task-rule-1',
            sourceType: 'diagnosis_result',
            trustClass: 'internal',
            summary: 'pnpm 锁文件导致安装失败',
            createdAt: '2026-03-27T08:10:00.000Z'
          }
        ],
        trace: [
          {
            node: 'agent_error',
            at: '2026-03-27T08:09:00.000Z',
            summary: 'pnpm install failed',
            data: {
              ministry: 'bingbu-ops',
              errorCode: 'tool_execution_error',
              errorCategory: 'tool',
              toolName: 'run_terminal',
              retryable: true
            }
          }
        ]
      },
      {
        id: 'task-rule-2',
        goal: '再次修复 pnpm 安装失败',
        status: 'failed',
        currentMinistry: 'bingbu-ops',
        currentWorker: 'bingbu-worker',
        connectorRefs: [],
        approvals: [],
        messages: [],
        agentStates: [],
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:10:00.000Z',
        externalSources: [
          {
            id: 'diag-2',
            taskId: 'task-rule-2',
            sourceType: 'diagnosis_result',
            trustClass: 'internal',
            summary: '建议使用更稳的安装策略',
            createdAt: '2026-03-27T09:10:00.000Z'
          }
        ],
        trace: [
          {
            node: 'agent_error',
            at: '2026-03-27T09:09:00.000Z',
            summary: 'pnpm install failed again',
            data: {
              ministry: 'bingbu-ops',
              errorCode: 'tool_execution_error',
              errorCategory: 'tool',
              toolName: 'run_terminal',
              retryable: true
            }
          }
        ]
      }
    ]);

    const learning = await service.getLearningCenter();
    expect(learning.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'rule',
          status: 'pending_confirmation',
          summary: expect.stringContaining('tool_execution_error')
        })
      ])
    );
  });

  it('learning center 优先暴露独立 runtime governance store 中的 capability 长期画像', async () => {
    const service = createService();
    let snapshot: any = {
      tasks: [],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      governance: {
        disabledSkillSourceIds: [],
        disabledCompanyWorkerIds: [],
        disabledConnectorIds: [],
        configuredConnectors: [],
        connectorDiscoveryHistory: [],
        connectorPolicyOverrides: [],
        capabilityPolicyOverrides: [],
        capabilityGovernanceProfiles: [
          {
            capabilityId: 'skill-product-review',
            displayName: 'Product Review',
            ownerType: 'specialist-owned',
            kind: 'skill',
            trustLevel: 'high',
            trustTrend: 'up',
            reportCount: 6,
            promoteCount: 4,
            holdCount: 1,
            downgradeCount: 1,
            passCount: 4,
            reviseRequiredCount: 1,
            blockCount: 1,
            lastTaskId: 'task-9',
            lastReviewDecision: 'pass',
            lastTrustAdjustment: 'promote',
            lastReason: '终审通过。',
            lastGovernanceSummary: '治理链建议继续提升信任。',
            updatedAt: '2026-03-31T00:00:00.000Z'
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
            passCount: 3,
            reviseRequiredCount: 1,
            blockCount: 0,
            lastTaskId: 'task-1',
            lastReviewDecision: 'pass',
            lastTrustAdjustment: 'promote',
            lastReason: '终审通过。',
            updatedAt: '2026-03-31T00:00:00.000Z'
          }
        ],
        workerGovernanceProfiles: [
          {
            entityId: 'worker-product-review',
            displayName: 'worker-product-review',
            entityKind: 'worker',
            trustLevel: 'high',
            trustTrend: 'up',
            reportCount: 4,
            promoteCount: 3,
            holdCount: 1,
            downgradeCount: 0,
            passCount: 3,
            reviseRequiredCount: 1,
            blockCount: 0,
            lastTaskId: 'task-1',
            lastReviewDecision: 'pass',
            lastTrustAdjustment: 'promote',
            lastReason: '终审通过。',
            updatedAt: '2026-03-31T00:00:00.000Z'
          }
        ],
        specialistGovernanceProfiles: [
          {
            entityId: 'product-strategy',
            displayName: '产品策略',
            entityKind: 'specialist',
            trustLevel: 'medium',
            trustTrend: 'steady',
            reportCount: 2,
            promoteCount: 1,
            holdCount: 1,
            downgradeCount: 0,
            passCount: 2,
            reviseRequiredCount: 0,
            blockCount: 0,
            lastTaskId: 'task-1',
            lastReviewDecision: 'pass',
            lastTrustAdjustment: 'hold',
            lastReason: '终审通过。',
            updatedAt: '2026-03-31T00:00:00.000Z'
          }
        ],
        counselorSelectorConfigs: [],
        learningConflictScan: { scannedAt: '', conflictPairs: [], mergeSuggestions: [], manualReviewQueue: [] }
      },
      governanceAudit: []
    };
    collaborators(service).runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async next => {
        snapshot = next;
      })
    };
    collaborators(service).orchestrator.listTasks.mockReturnValue([]);
    collaborators(service).orchestrator.listLearningJobs.mockReturnValue([]);
    collaborators(service).orchestrator.listLearningQueue = vi.fn(() => []);

    const learning = await service.getLearningCenter();
    expect(learning.capabilityTrustProfiles).toEqual([
      expect.objectContaining({
        capabilityId: 'skill-product-review',
        reportCount: 6,
        promoteCount: 4,
        downgradeCount: 1
      })
    ]);
    expect(learning.ministryGovernanceProfiles).toEqual([
      expect.objectContaining({ entityId: 'hubu-search', reportCount: 4 })
    ]);
    expect(learning.workerGovernanceProfiles).toEqual([
      expect.objectContaining({ entityId: 'worker-product-review', reportCount: 4 })
    ]);
    expect(learning.specialistGovernanceProfiles).toEqual([
      expect.objectContaining({ entityId: 'product-strategy', reportCount: 2 })
    ]);
  });

  it('platform console 会同时暴露审批原因码与 richer learning metadata', async () => {
    const service = createService();
    collaborators(service).orchestrator.listPendingApprovals.mockReturnValue([
      {
        id: 'task-approval-1',
        goal: '更新敏感配置',
        status: 'waiting_approval',
        sessionId: 'session-1',
        currentMinistry: 'gongbu-code',
        currentWorker: 'worker-1',
        pendingApproval: {
          toolName: 'write_local_file',
          intent: 'write_file',
          riskLevel: 'high',
          reason: '路径属于敏感位置，需要审批。',
          reasonCode: 'requires_approval_destructive',
          preview: [{ label: 'Path', value: '.env.local' }]
        },
        approvals: [
          {
            taskId: 'task-approval-1',
            intent: 'write_file',
            decision: 'pending',
            decidedAt: '2026-03-28T00:00:00.000Z',
            reason: 'fallback reason'
          }
        ]
      }
    ]);
    collaborators(service).orchestrator.listTasks.mockReturnValue([
      {
        id: 'task-learn-1',
        goal: '主聊天区只显示最终答复',
        status: 'completed',
        sessionId: 'session-1',
        currentMinistry: 'libu-governance',
        currentWorker: 'worker-2',
        connectorRefs: [],
        approvals: [],
        messages: [],
        agentStates: [],
        trace: [],
        learningCandidates: [
          {
            id: 'candidate-1',
            taskId: 'task-learn-1',
            type: 'memory',
            summary: '用户偏好主聊天区只显示最终答复',
            status: 'pending_confirmation',
            payload: { id: 'mem-1' },
            autoConfirmEligible: true,
            createdAt: '2026-03-28T00:00:00.000Z'
          }
        ],
        learningEvaluation: {
          score: 91,
          confidence: 'high',
          notes: ['检测到稳定偏好，已进入自动学习。'],
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          skippedReasons: ['未检测到新的技能抽取条件。'],
          conflictDetected: true,
          conflictTargets: ['mem-existing-1'],
          derivedFromLayers: ['L1-session', 'L5-runtime-snapshot'],
          policyMode: 'profile-inherited',
          expertiseSignals: ['user-preference', 'domain-expert'],
          recommendedCandidateIds: ['candidate-1'],
          autoConfirmCandidateIds: ['candidate-1'],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 1,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        updatedAt: '2026-03-28T00:00:00.000Z',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ]);
    collaborators(service).orchestrator.listRules.mockResolvedValue([]);
    collaborators(service).orchestrator.listLearningJobs.mockReturnValue([]);
    collaborators(service).sessionCoordinator.listSessions.mockReturnValue([
      {
        id: 'session-1',
        title: 'demo',
        status: 'completed',
        updatedAt: '2026-03-28T00:00:00.000Z',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ]);
    collaborators(service).sessionCoordinator.getCheckpoint.mockReturnValue({
      sessionId: 'session-1',
      taskId: 'task-learn-1',
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 1,
      graphState: { status: 'completed' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    });

    const centersService = (service as any).centersService;
    vi.spyOn(centersService, 'getRuntimeCenter').mockResolvedValue({
      recentRuns: [],
      usageAnalytics: {
        daily: [],
        persistedDailyHistory: []
      }
    });
    vi.spyOn(centersService, 'getEvalsCenter').mockResolvedValue({
      dailyTrend: [],
      persistedDailyHistory: [],
      recentRuns: [],
      promptRegression: {
        suites: []
      }
    });
    vi.spyOn(centersService, 'getSkillSourcesCenter').mockResolvedValue({
      sources: [],
      manifests: [],
      installed: [],
      receipts: []
    });
    vi.spyOn(centersService, 'getConnectorsCenter').mockResolvedValue([]);
    vi.spyOn(centersService, 'getCompanyAgentsCenter').mockResolvedValue([]);
    vi.spyOn(centersService, 'getEvidenceCenter').mockResolvedValue({
      totalEvidenceCount: 0,
      recentEvidence: []
    });

    const consoleRecord = await service.getPlatformConsole();
    expect(consoleRecord.approvals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pendingApproval: expect.objectContaining({
            reasonCode: 'requires_approval_destructive',
            toolName: 'write_local_file',
            preview: [{ label: 'Path', value: '.env.local' }]
          })
        })
      ])
    );
    expect(consoleRecord.learning.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          skippedReasons: ['未检测到新的技能抽取条件。'],
          conflictDetected: true,
          conflictTargets: ['mem-existing-1'],
          derivedFromLayers: ['L1-session', 'L5-runtime-snapshot'],
          policyMode: 'profile-inherited',
          expertiseSignals: ['user-preference', 'domain-expert']
        })
      ])
    );
  });
});
