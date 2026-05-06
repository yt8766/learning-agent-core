import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedButtons: Array<{ children?: unknown; onClick?: () => void | Promise<void> }> = [];

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void | Promise<void> }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

import { RuntimeSummaryVisuals } from '@/pages/runtime-overview/components/runtime-summary-visuals';

describe('RuntimeSummaryVisuals', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
  });

  it('renders empty states when visual records are unavailable', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryVisuals
        runtime={
          {
            imperialChain: [],
            executionSpans: [],
            thoughtGraphs: [],
            modelHeatmap: []
          } as any
        }
        onSelectTask={vi.fn()}
      />
    );

    expect(html).toContain('当前还没有首辅七节点链路样本。');
    expect(html).toContain('当前还没有六部执行 span。');
    expect(html).toContain('当前还没有可视化 ThoughtGraph。');
    expect(html).toContain('当前还没有模型效能热力图数据。');
  });

  it('renders imperial chain, interrupt ledger, thought graph, and heatmap details', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryVisuals
        runtime={
          {
            imperialChain: [
              {
                taskId: 'task-1',
                goal: '推进治理链',
                node: 'entry_router',
                modeGateState: { activeMode: 'plan', reason: '先计划' },
                budgetGateState: { status: 'closed', summary: '预算吃紧', queueDepth: 3 },
                complexTaskPlan: { summary: '拆成 2 个子目标', subGoals: ['A', 'B'] },
                blackboardState: { refs: { traceCount: 4, evidenceCount: 2 } },
                dispatches: [
                  { kind: 'hubu', selectedAgentId: 'official.coder' },
                  { kind: 'gongbu', selectedAgentId: 'official.reviewer' }
                ],
                contextFilterState: {
                  filteredContextSlice: { summary: '保留关键上下文', historyTraceCount: 5 },
                  audienceSlices: {
                    strategy: { dispatchCount: 1 },
                    ministry: { dispatchCount: 2 },
                    fallback: { dispatchCount: 1 }
                  }
                },
                finalReviewState: {
                  summary: '终审通过',
                  deliveryStatus: 'delivered',
                  deliveryMinistry: 'libu-docs'
                },
                criticState: { decision: 'rewrite_required', summary: '需回流修订' },
                guardrailState: { stage: 'review', verdict: 'warning', summary: '谨慎处理' },
                sandboxState: { stage: 'verify', status: 'passed', attempt: 1, maxAttempts: 2 },
                knowledgeIndexState: { indexStatus: 'ready', searchableDocumentCount: 6, blockedDocumentCount: 1 },
                governanceScore: { score: 88, status: 'healthy', trustAdjustment: 0.2 }
              }
            ],
            executionSpans: [
              {
                taskId: 'task-1',
                ministries: ['gongbu-code', 'xingbu-review'],
                microLoopCount: 2,
                maxMicroLoops: 3,
                currentMinistry: 'gongbu-code',
                dispatchKinds: ['hubu', 'gongbu'],
                sandboxState: { stage: 'verify', status: 'passed', verdict: 'allow' },
                microLoopState: { state: 'running', attempt: 2, maxAttempts: 3, exhaustedReason: 'none' }
              }
            ],
            interruptLedger: [
              {
                taskId: 'task-1',
                activeInterrupt: { kind: 'approval' },
                interruptHistory: [{ id: 'interrupt-1' }]
              }
            ],
            thoughtGraphs: [
              {
                taskId: 'task-1',
                goal: '推进治理链',
                currentMinistry: 'gongbu-code',
                currentNode: 'execute',
                graph: {
                  nodes: [
                    { id: 'n1', kind: 'plan', label: 'Plan', status: 'running' },
                    { id: 'n2', kind: 'review', label: 'Review', status: 'blocked' }
                  ]
                }
              }
            ],
            modelHeatmap: [
              {
                ministry: 'gongbu-code',
                model: 'gpt-5.4',
                avgLatencyMs: 1200,
                successRate: 0.95,
                avgCostUsd: 0.22,
                retryRate: 0.15
              }
            ],
            strategyCounselors: [
              {
                taskId: 'task-1',
                goal: '推进治理链',
                counselors: [{ displayName: '首辅票拟官' }]
              }
            ],
            plannerStrategies: [
              {
                taskId: 'task-1',
                goal: '推进治理链',
                strategy: {
                  mode: 'rich-candidates',
                  summary: '多个候选官方 Agent，可先并行研究后再收敛。',
                  leadDomain: 'technical-architecture',
                  requiredCapabilities: ['specialist.technical-architecture'],
                  preferredAgentId: 'official.coder',
                  candidateAgentIds: ['official.coder', 'official.reviewer'],
                  candidateCount: 2,
                  gapDetected: false
                }
              }
            ],
            libuScorecards: [{ taskId: 'task-1', summary: '礼部建议可直接交付' }],
            governanceScorecards: [{ taskId: 'task-1', summary: '治理评分稳定' }],
            shiluAdjustments: [{ taskId: 'task-1', recommendedCandidateIds: ['memory-1', 'rule-2'] }],
            knowledgeOverview: {
              sourceCount: 3,
              chunkCount: 12,
              embeddingCount: 9,
              searchableDocumentCount: 8,
              blockedDocumentCount: 1,
              stores: [
                {
                  id: 'store-1',
                  displayName: '主知识库',
                  summary: '覆盖 runtime 与评估资料',
                  store: 'local-vector',
                  status: 'ready'
                }
              ]
            },
            knowledgeSearchStatus: {
              configuredMode: 'hybrid',
              effectiveMode: 'keyword-only',
              vectorProviderId: 'missing-client',
              vectorConfigured: true,
              hybridEnabled: false,
              vectorProviderHealth: {
                status: 'degraded',
                checkedAt: '2026-05-01T00:00:00.000Z',
                message: 'connection refused'
              },
              diagnostics: [
                {
                  code: 'knowledge.vector_provider.missing_client',
                  severity: 'warning',
                  message: 'vector client missing'
                }
              ],
              checkedAt: '2026-05-01T00:00:00.000Z'
            },
            knowledgeSearchLastDiagnostics: {
              query: 'HX-9000 semantic alias',
              limit: 4,
              hitCount: 1,
              total: 3,
              diagnostics: {
                retrievalMode: 'hybrid',
                enabledRetrievers: ['keyword', 'vector'],
                failedRetrievers: ['vector'],
                candidateCount: 7,
                fusionStrategy: 'rrf',
                prefilterApplied: true,
                postRetrieval: {
                  filtering: {
                    beforeCount: 6,
                    afterCount: 4,
                    droppedCount: 2,
                    maskedCount: 1
                  },
                  ranking: {
                    strategy: 'deterministic-signals+semantic-rerank',
                    signals: ['retrieval-score', 'authority', 'semantic-rerank', 'alignment']
                  },
                  diversification: {
                    beforeCount: 4,
                    afterCount: 3,
                    maxPerSource: 2
                  }
                }
              },
              searchedAt: '2026-05-01T00:01:00.000Z'
            }
          } as any
        }
        onSelectTask={vi.fn()}
      />
    );

    expect(html).toContain('Imperial Chain');
    expect(html).toContain('预算门: closed / 预算吃紧 / queue 3');
    expect(html).toContain('军机处: 拆成 2 个子目标 / subGoals 2');
    expect(html).toContain('已收敛 official.coder / official.reviewer');
    expect(html).toContain('受众切片: 策略 1 / 六部 2 / 兜底 1');
    expect(html).toContain('司礼监账本: 有待恢复中断 / history 1');
    expect(html).toContain('Visual ThoughtChain');
    expect(html).toContain('Model Heatmap');
    expect(html).toContain('gpt-5.4');
    expect(html).toContain('95% success');
    expect(html).toContain('$0.2200');
    expect(html).toContain('retryRate: 15%');
    expect(html).toContain('Strategy &amp; Learning');
    expect(html).toContain('首辅票拟官');
    expect(html).toContain('规划策略: rich-candidates');
    expect(html).toContain('specialist.technical-architecture');
    expect(html).toContain('official.coder / official.reviewer');
    expect(html).toContain('memory-1 / rule-2');
    expect(html).toContain('Wenyuan &amp; Cangjing');
    expect(html).toContain('主知识库');
    expect(html).toContain('retrieval hybrid -&gt; keyword-only');
    expect(html).toContain('vector configured / hybrid disabled');
    expect(html).toContain('provider missing-client');
    expect(html).toContain('health degraded');
    expect(html).toContain('warnings 1');
    expect(html).toContain('latest query hits 1/3');
    expect(html).toContain('mode hybrid');
    expect(html).toContain('retrievers keyword, vector / failed vector');
    expect(html).toContain('candidates 7');
    expect(html).toContain('fusion rrf');
    expect(html).toContain('prefilter applied');
    expect(html).toContain('filter 6-&gt;4 / dropped 2 / masked 1');
    expect(html).toContain(
      'rank deterministic-signals+semantic-rerank / retrieval-score, authority, semantic-rerank, alignment'
    );
    expect(html).toContain('diversify 4-&gt;3 / maxPerSource 2');
  });

  it('routes task selection buttons back to the parent callback', async () => {
    const onSelectTask = vi.fn();

    renderToStaticMarkup(
      <RuntimeSummaryVisuals
        runtime={
          {
            imperialChain: [
              {
                taskId: 'task-1',
                goal: '推进治理链',
                node: 'entry_router',
                modeGateState: { activeMode: 'plan', reason: '先计划' }
              }
            ],
            executionSpans: [],
            interruptLedger: [],
            thoughtGraphs: [
              {
                taskId: 'task-2',
                goal: '推进可视化链路',
                currentMinistry: 'gongbu-code',
                currentNode: 'execute',
                graph: {
                  nodes: [{ id: 'n1', kind: 'plan', label: 'Plan', status: 'running' }]
                }
              }
            ],
            modelHeatmap: [],
            strategyCounselors: [],
            knowledgeOverview: undefined
          } as any
        }
        onSelectTask={onSelectTask}
      />
    );

    await renderedButtons[0]?.onClick?.();
    await renderedButtons[1]?.onClick?.();

    expect(onSelectTask).toHaveBeenNthCalledWith(1, 'task-1');
    expect(onSelectTask).toHaveBeenNthCalledWith(2, 'task-2');
  });

  it('skips incomplete post-retrieval diagnostics without rendering placeholder metrics', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryVisuals
        runtime={
          {
            imperialChain: [],
            executionSpans: [],
            thoughtGraphs: [],
            modelHeatmap: [],
            knowledgeOverview: {
              sourceCount: 1,
              chunkCount: 2,
              embeddingCount: 2,
              searchableDocumentCount: 1,
              blockedDocumentCount: 0,
              stores: []
            },
            knowledgeSearchLastDiagnostics: {
              query: 'partial',
              limit: 3,
              hitCount: 0,
              total: 0,
              diagnostics: {
                postRetrieval: {
                  filtering: { beforeCount: 2 },
                  ranking: { strategy: 'deterministic-signals', signals: [] },
                  diversification: { beforeCount: 2, maxPerSource: 2 }
                }
              },
              searchedAt: '2026-05-01T00:01:00.000Z'
            }
          } as any
        }
        onSelectTask={vi.fn()}
      />
    );

    expect(html).toContain('latest query hits 0/0');
    expect(html).not.toContain('filter ');
    expect(html).not.toContain('masked');
    expect(html).not.toContain('rank deterministic-signals');
    expect(html).not.toContain('diversify ');
  });

  it('renders knowledge status when diagnostics array is missing from a legacy payload', () => {
    const html = renderToStaticMarkup(
      <RuntimeSummaryVisuals
        runtime={
          {
            imperialChain: [],
            executionSpans: [],
            thoughtGraphs: [],
            modelHeatmap: [],
            knowledgeOverview: {
              sourceCount: 1,
              chunkCount: 2,
              embeddingCount: 2,
              searchableDocumentCount: 1,
              blockedDocumentCount: 0,
              stores: []
            },
            knowledgeSearchStatus: {
              configuredMode: 'hybrid',
              effectiveMode: 'keyword-only',
              vectorProviderId: 'legacy-provider',
              vectorConfigured: true,
              hybridEnabled: false,
              checkedAt: '2026-05-01T00:00:00.000Z'
            }
          } as any
        }
        onSelectTask={vi.fn()}
      />
    );

    expect(html).toContain('retrieval hybrid -&gt; keyword-only');
    expect(html).toContain('provider legacy-provider');
    expect(html).not.toContain('warnings');
  });
});
