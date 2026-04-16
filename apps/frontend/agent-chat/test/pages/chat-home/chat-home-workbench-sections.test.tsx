import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  buildWorkbenchSectionState,
  ChatHomeApprovalActions,
  getWorkbenchInterruptCopy
} from '@/pages/chat-home/chat-home-workbench-sections';
import { renderEvidenceSection } from '@/pages/chat-home/chat-home-workbench-section-renders';

// activeInterrupt in these tests is the persisted 司礼监 / InterruptController projection.
describe('chat-home-workbench-sections helpers', () => {
  it('returns plan-question copy for planning interrupts', () => {
    expect(
      getWorkbenchInterruptCopy({
        activeInterrupt: {
          kind: 'user-input',
          payload: { interactionKind: 'plan-question' }
        },
        planDraft: {
          questionSet: {
            title: '方案确认',
            summary: '需要你确认整体方向。'
          }
        }
      } as any)
    ).toEqual(
      expect.objectContaining({
        tag: '计划提问',
        summary: '方案确认'
      })
    );
  });

  it('returns supplemental-input and approval copies for runtime interrupts', () => {
    expect(
      getWorkbenchInterruptCopy({
        activeInterrupt: {
          kind: 'runtime-governance',
          intent: 'run_terminal',
          reason: '需要补充仓库路径',
          payload: { interactionKind: 'supplemental-input' }
        }
      } as any)
    ).toEqual(
      expect.objectContaining({
        tag: '补充输入',
        summary: 'run_terminal',
        detail: '需要补充仓库路径'
      })
    );

    expect(
      getWorkbenchInterruptCopy({
        pendingApproval: {
          toolName: 'write_file',
          reason: '等待高风险操作确认'
        }
      } as any)
    ).toEqual(
      expect.objectContaining({
        tag: '操作确认',
        summary: 'write_file',
        detail: '等待高风险操作确认'
      })
    );
  });

  it('builds workbench sections for checkpoint, reuse, approval history and event stream', () => {
    const state = buildWorkbenchSectionState(
      {
        activeSession: {
          status: 'waiting_interrupt',
          compression: { condensedMessageCount: 4 }
        },
        checkpoint: {
          executionMode: 'plan',
          graphState: { currentStep: 'planning' },
          resolvedWorkflow: {
            displayName: 'General Collaboration',
            requiredMinistries: ['gongbu', 'xingbu']
          },
          currentMinistry: 'gongbu',
          currentWorker: 'gongbu-code',
          currentNode: 'planning_gate',
          skillStage: 'skill-eval',
          chatRoute: {
            adapter: 'chat-entry',
            flow: 'supervisor',
            priority: 2
          },
          approvalFeedback: '请补充回退方案。',
          planDraft: {
            questionSet: {
              title: '方案确认',
              summary: '需要你确认整体方向。'
            },
            microBudget: {
              readOnlyToolsUsed: 2,
              readOnlyToolLimit: 4,
              budgetTriggered: false
            }
          },
          activeInterrupt: {
            kind: 'user-input',
            payload: { interactionKind: 'plan-question' }
          },
          pendingApproval: {
            toolName: 'write_file',
            reason: '等待高风险操作确认'
          },
          modelRoute: [
            {
              selectedModel: 'gpt-5.4',
              defaultModel: 'gpt-5.4-mini',
              workerId: 'worker-1',
              ministry: 'gongbu'
            }
          ],
          specialistFindings: [
            {
              specialistId: 'security-reviewer',
              summary: '发现依赖升级风险',
              domain: 'security',
              source: 'review',
              contractVersion: 'v1',
              stage: 'review',
              riskLevel: 'high',
              confidence: 0.9,
              constraints: ['冻结版本'],
              suggestions: ['补充回滚预案'],
              blockingIssues: ['缺少验证结果']
            }
          ],
          externalSources: [
            {
              id: 'src-1',
              sourceType: 'article',
              summary: '官方更新说明',
              sourceUrl: 'https://example.com/post',
              trustClass: 'official',
              fetchedAt: '2026-04-01T08:00:00.000Z'
            }
          ],
          learningEvaluation: {
            score: 0.82,
            confidence: 'high',
            notes: ['可沉淀为长期经验'],
            recommendedCandidateIds: ['cand-1'],
            autoConfirmCandidateIds: ['cand-1']
          },
          reusedMemories: ['memory-1'],
          reusedRules: ['rule-1'],
          reusedSkills: ['skill-1'],
          usedCompanyWorkers: ['company-agent-1'],
          agentStates: [
            {
              observations: ['LLM fallback to cheaper model']
            }
          ]
        },
        events: [
          {
            id: 'event-approval',
            type: 'approval_resolved',
            at: '2026-04-01T09:00:00.000Z',
            payload: {
              intent: 'write_file',
              toolName: 'fs.write',
              reason: '批准执行',
              feedback: '继续'
            }
          }
        ]
      } as any,
      [
        {
          id: 'stream-1',
          type: 'status_changed',
          summary: '进入 review',
          at: '2026-04-01T09:10:00.000Z',
          raw: '{"status":"review"}'
        }
      ]
    );

    expect(state.runningHint).toContain('等待你回答计划问题');
    expect(state.compressionHint).toContain('已折叠 4 条消息');
    expect(state.llmFallbackNotes).toEqual(['LLM fallback to cheaper model']);
    expect(state.workbenchItems).toHaveLength(7);
  });

  it('builds evidence variants and handles empty workbench state', () => {
    const rich = buildWorkbenchSectionState(
      {
        activeSession: {
          status: 'running'
        },
        checkpoint: {
          executionMode: 'execute',
          graphState: { currentStep: 'delivery' },
          externalSources: [
            {
              id: 'freshness-1',
              sourceType: 'freshness_meta',
              summary: 'Freshness 校验',
              trustClass: 'internal',
              detail: {
                referenceTime: '2026-04-08T12:00:00.000Z',
                sourceCount: 3
              }
            }
          ],
          specialistFindings: [
            {
              specialistId: 'general',
              summary: '兜底发现',
              domain: 'general',
              source: 'fallback',
              degraded: true,
              fallbackMessage: '已降级为通用发现',
              contractVersion: 'v1',
              stage: 'dispatch'
            }
          ],
          learningEvaluation: {
            score: 0.6,
            confidence: 'medium',
            notes: [],
            recommendedCandidateIds: [],
            autoConfirmCandidateIds: []
          },
          agentStates: []
        },
        events: []
      } as any,
      []
    );

    expect(rich.runningHint).toBe('正在执行：delivery');
    expect(rich.compressionHint).toBe('');
    expect(rich.workbenchItems).toHaveLength(4);

    const empty = buildWorkbenchSectionState(
      {
        activeSession: {
          status: 'completed'
        },
        events: []
      } as any,
      []
    );

    expect(empty.runningHint).toBe('');
    expect(empty.compressionHint).toBe('');
    expect(empty.llmFallbackNotes).toEqual([]);
    expect(empty.workbenchItems).toHaveLength(0);
  });

  it('renders failure alert item when the session has stopped', () => {
    const html = renderToStaticMarkup(
      <ChatHomeApprovalActions
        chat={
          {
            activeSession: {
              status: 'failed'
            }
          } as any
        }
      />
    );

    expect(html).toContain('当前轮次已停止');
    expect(html).toContain('恢复执行');
  });

  it('renders memory evidence reasons, score, entity and scope details in the evidence section', () => {
    const section = renderEvidenceSection({
      checkpoint: {
        externalSources: [
          {
            id: 'memory-source-1',
            taskId: 'task-1',
            sourceType: 'memory_reuse',
            trustClass: 'internal',
            summary: '已命中历史记忆：项目 A 不要自动提交。',
            detail: {
              reason: 'entity matched; same scope; strong relevance',
              score: 0.91,
              relatedEntities: [
                { entityType: 'project', entityId: 'repo:a' },
                { entityType: 'workspace', entityId: 'workspace:core' }
              ],
              scopeType: 'workspace'
            },
            createdAt: '2026-04-16T00:00:00.000Z'
          }
        ]
      }
    } as any);

    const html = renderToStaticMarkup(<>{section?.children}</>);

    expect(html).toContain('采用原因：entity matched; same scope; strong relevance');
    expect(html).toContain('score 0.91');
    expect(html).toContain('project:repo:a');
    expect(html).toContain('workspace');
  });
});
