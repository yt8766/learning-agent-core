export function createLearningCenterFixture() {
  return {
    tasks: [
      {
        id: 'task-1',
        goal: '主聊天区只显示最终答复',
        currentMinistry: 'libu-governance',
        currentWorker: 'worker-1',
        updatedAt: '2026-03-28T00:00:00.000Z',
        learningCandidates: [
          {
            id: 'candidate-1',
            taskId: 'task-1',
            type: 'memory',
            summary: '用户偏好主聊天区只显示最终答复',
            status: 'pending_confirmation',
            payload: {
              id: 'mem-1',
              type: 'fact',
              summary: '用户偏好主聊天区只显示最终答复',
              content: '...',
              tags: ['user-preference'],
              createdAt: '2026-03-28T00:00:00.000Z'
            },
            autoConfirmEligible: true,
            createdAt: '2026-03-28T00:00:00.000Z'
          }
        ],
        learningEvaluation: {
          score: 88,
          confidence: 'high',
          notes: ['检测到稳定偏好，已进入自动学习。'],
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          skippedReasons: ['未检测到新的 skill 抽取条件。'],
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
        governanceReport: {
          ministry: 'libu-governance',
          summary: '治理链认为本轮结果可继续提升信任。',
          executionQuality: { score: 91, summary: '执行质量稳定。' },
          evidenceSufficiency: { score: 87, summary: '证据链完整。' },
          sandboxReliability: { score: 90, summary: 'sandbox 稳定。' },
          reviewOutcome: { decision: 'pass', summary: '终审通过。' },
          interruptLoad: { interruptCount: 0, microLoopCount: 0, summary: '无额外负载。' },
          businessFeedback: { score: 82, summary: '可交付。' },
          recommendedLearningTargets: ['memory', 'skill'],
          trustAdjustment: 'promote',
          updatedAt: '2026-03-28T00:20:00.000Z'
        },
        capabilityAttachments: [
          {
            id: 'skill-product-review',
            displayName: 'Product Review',
            capabilityTrust: {
              trustLevel: 'high',
              trustTrend: 'up',
              lastReason: '终审通过。',
              updatedAt: '2026-03-28T00:20:00.000Z'
            },
            governanceProfile: {
              reportCount: 3,
              promoteCount: 2,
              holdCount: 1,
              downgradeCount: 0,
              passCount: 2,
              reviseRequiredCount: 1,
              blockCount: 0,
              lastTaskId: 'task-1',
              lastReviewDecision: 'pass',
              lastTrustAdjustment: 'promote',
              recentOutcomes: [
                {
                  taskId: 'task-1',
                  reviewDecision: 'pass',
                  trustAdjustment: 'promote',
                  updatedAt: '2026-03-28T00:20:00.000Z'
                }
              ],
              updatedAt: '2026-03-28T00:20:00.000Z'
            },
            updatedAt: '2026-03-28T00:20:00.000Z'
          }
        ]
      }
    ] as any,
    jobs: [],
    wenyuanOverviewPromise: Promise.resolve({
      store: 'wenyuan' as const,
      rootPath: '/tmp/runtime',
      memoryCount: 3,
      sessionCount: 2,
      checkpointCount: 2,
      traceCount: 7,
      governanceHistoryCount: 4,
      updatedAt: '2026-03-28T02:00:00.000Z'
    }),
    knowledgeOverviewPromise: Promise.resolve({
      sourceCount: 5,
      chunkCount: 9,
      embeddingCount: 7,
      searchableDocumentCount: 4,
      blockedDocumentCount: 1,
      latestReceipts: [{ id: 'receipt-1', status: 'completed', updatedAt: '2026-03-28T02:00:00.000Z' }]
    }),
    learningQueue: [
      {
        id: 'queue-1',
        taskId: 'task-1',
        status: 'queued',
        mode: 'task-learning',
        queuedAt: '2026-03-28T00:10:00.000Z',
        updatedAt: '2026-03-28T00:10:00.000Z',
        priority: 'high',
        capabilityUsageStats: { toolCount: 2, workerCount: 1, totalTokens: 1200, totalCostUsd: 0.3 }
      },
      {
        id: 'dream-1',
        taskId: 'task-1',
        status: 'completed',
        mode: 'dream-task',
        queuedAt: '2026-03-28T00:12:00.000Z',
        updatedAt: '2026-03-28T00:20:00.000Z',
        finishedAt: '2026-03-28T00:20:00.000Z',
        summary: '整理高价值阻断经验',
        candidateSummary: 'memory 1 / rule 0 / skill 0',
        priority: 'normal',
        capabilityUsageStats: { toolCount: 1, workerCount: 1, totalTokens: 480, totalCostUsd: 0.09 }
      }
    ],
    memoryStatsPromise: Promise.resolve({
      invalidated: 0,
      quarantined: 1,
      recentQuarantined: [
        {
          id: 'mem-quarantine-1',
          summary: '被运行态污染的经验',
          quarantineReason: 'contains runtime noise',
          quarantineCategory: 'runtime_noise',
          quarantineReasonDetail: 'Matched suspicious runtime artifact token "礼部".',
          quarantineRestoreSuggestion: '清理运行态污染后再恢复。',
          quarantinedAt: '2026-03-28T01:00:00.000Z'
        }
      ]
    }),
    invalidatedRulesPromise: Promise.resolve(0),
    crossCheckEvidencePromise: Promise.resolve([
      {
        memoryId: 'mem-quarantine-1',
        record: {
          id: 'official-rule:runtime-noise',
          taskId: 'memory:mem-quarantine-1',
          sourceId: 'official-rule:runtime-noise',
          sourceType: 'official_rule',
          trustClass: 'official',
          summary: '运行态污染规则交叉校验',
          detail: { memoryId: 'mem-quarantine-1' },
          createdAt: '2026-03-28T01:00:00.000Z',
          fetchedAt: '2026-03-28T01:00:00.000Z'
        }
      }
    ]),
    governanceSnapshotPromise: Promise.resolve({
      governance: {
        ministryGovernanceProfiles: [
          {
            entityId: 'libu-governance',
            displayName: 'libu-governance',
            entityKind: 'ministry',
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
        workerGovernanceProfiles: [
          {
            entityId: 'worker-1',
            displayName: 'worker-1',
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
            entityId: 'general-assistant',
            displayName: '通用助理',
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
        counselorSelectorConfigs: [
          {
            selectorId: 'payment-selector-v2',
            domain: 'payment',
            enabled: true,
            strategy: 'task-type',
            candidateIds: ['payment-counselor-v1', 'payment-counselor-v2'],
            defaultCounselorId: 'payment-counselor-v1',
            createdAt: '2026-03-28T01:00:00.000Z',
            updatedAt: '2026-03-28T01:00:00.000Z'
          }
        ],
        learningConflictScan: {
          scannedAt: '2026-03-28T02:00:00.000Z',
          conflictPairs: [
            {
              id: 'conflict-1',
              contextSignature: 'ctx-payment',
              memoryIds: ['mem-1', 'mem-2'],
              severity: 'low',
              resolution: 'lightweight_review_required',
              status: 'open',
              effectivenessSpread: 0.08
            }
          ],
          mergeSuggestions: [
            {
              conflictId: 'conflict-1',
              preferredMemoryId: 'mem-1',
              loserMemoryIds: ['mem-2'],
              suggestion: 'Route to lightweight review before persisting any replacement.'
            }
          ],
          manualReviewQueue: [
            {
              id: 'review-1',
              contextSignature: 'ctx-payment',
              memoryIds: ['mem-1', 'mem-2'],
              severity: 'low',
              resolution: 'lightweight_review_required',
              preferredMemoryId: 'mem-1',
              effectivenessSpread: 0.08,
              status: 'open',
              createdAt: '2026-03-28T02:00:00.000Z',
              updatedAt: '2026-03-28T02:00:00.000Z'
            }
          ]
        }
      }
    }),
    resolveLocalSkillSuggestions: async () => ({ suggestions: [], gapSummary: undefined, profile: 'personal' })
  };
}
