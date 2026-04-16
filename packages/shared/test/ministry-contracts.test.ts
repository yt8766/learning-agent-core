import { describe, expect, it } from 'vitest';

import type {
  ApprovedExecutionAgentLike,
  CodeExecutionMinistryLike,
  CodeExecutionResult,
  DeliveryMinistryLike,
  DeliveryResearchResult,
  OpsExecutionMinistryLike,
  ReviewMinistryLike,
  ReviewMinistryResult,
  ResearchMinistryLike,
  ResearchMinistryResult,
  TaskRecord
} from '../src';

describe('shared ministry contracts', () => {
  it('re-exports research and delivery ministry contracts through the shared barrel', async () => {
    const researchResult: ResearchMinistryResult = {
      summary: '户部已整理研究摘要。',
      memories: [],
      knowledgeEvidence: [],
      skills: [],
      contractMeta: {
        contractName: 'research-evidence',
        contractVersion: 'research-evidence.v1',
        parseStatus: 'success',
        fallbackUsed: false
      }
    };
    const deliveryResearchResult: DeliveryResearchResult = {
      summary: '礼部已整理交付规范。',
      memories: [],
      skills: []
    };
    const codeExecutionResult: CodeExecutionResult = {
      intent: 'read_file',
      toolName: 'local-analysis',
      requiresApproval: false,
      summary: '工部已完成执行。'
    };
    const reviewResult: ReviewMinistryResult = {
      review: {
        taskId: 'task-1',
        decision: 'approved',
        notes: ['刑部终审通过。'],
        createdAt: '2026-04-16T00:00:00.000Z'
      },
      evaluation: {
        success: true,
        quality: 'high',
        shouldRetry: false,
        shouldWriteMemory: false,
        shouldCreateRule: false,
        shouldExtractSkill: false,
        notes: ['刑部终审通过。']
      },
      contractMeta: {
        contractName: 'review-decision',
        contractVersion: 'review-decision.v1',
        parseStatus: 'success',
        fallbackUsed: false
      }
    };
    const task = { id: 'task-1' } as TaskRecord;

    const researchMinistry: ResearchMinistryLike = {
      async research(subTask) {
        expect(subTask).toContain('研究');
        return researchResult;
      },
      getState() {
        return {
          agentId: 'hubu-task-1',
          role: 'research',
          goal: '整理研究',
          plan: [],
          toolCalls: [],
          observations: [],
          shortTermMemory: [],
          longTermMemoryRefs: [],
          status: 'completed'
        };
      }
    };
    const deliveryMinistry: DeliveryMinistryLike = {
      async research(nextTask) {
        expect(nextTask).toBe(task);
        return deliveryResearchResult;
      },
      async execute() {
        return {
          intent: 'read_file',
          toolName: 'documentation',
          requiresApproval: false,
          summary: '礼部已整理交付说明。'
        };
      },
      review() {
        return {
          review: {
            taskId: 'task-1',
            decision: 'approved',
            notes: ['礼部复核通过。'],
            createdAt: '2026-04-16T00:00:00.000Z'
          },
          evaluation: {
            success: true,
            quality: 'high',
            shouldRetry: false,
            shouldWriteMemory: false,
            shouldCreateRule: false,
            shouldExtractSkill: false,
            notes: ['礼部复核通过。']
          }
        };
      },
      buildDelivery() {
        return '礼部已整理最终交付。';
      },
      getState() {
        return {
          agentId: 'libu-docs-task-1',
          role: 'reviewer',
          goal: '整理交付',
          plan: [],
          toolCalls: [],
          observations: [],
          shortTermMemory: [],
          longTermMemoryRefs: [],
          status: 'completed'
        };
      }
    };
    const reviewMinistry: ReviewMinistryLike = {
      async review(_executionResult, executionSummary) {
        expect(executionSummary).toContain('执行');
        return reviewResult;
      },
      getState() {
        return {
          agentId: 'xingbu-task-1',
          role: 'reviewer',
          goal: '审查执行',
          plan: [],
          toolCalls: [],
          observations: [],
          shortTermMemory: [],
          longTermMemoryRefs: [],
          status: 'completed'
        };
      }
    };
    const codeMinistry: CodeExecutionMinistryLike = {
      async execute(subTask, researchSummary) {
        expect(subTask).toContain('执行');
        expect(researchSummary).toContain('研究');
        return codeExecutionResult;
      },
      buildApprovedState(executionResult, pending) {
        expect(pending.toolName).toBe('local-analysis');
        return {
          agentId: 'gongbu-task-1',
          role: 'executor',
          goal: '执行代码任务',
          plan: ['Receive human approval', 'Execute approved high-risk action'],
          toolCalls: [`intent:${pending.intent}`, `tool:${pending.toolName}`],
          observations: [executionResult.outputSummary],
          shortTermMemory: [pending.researchSummary, executionResult.outputSummary],
          longTermMemoryRefs: [],
          status: 'completed',
          finalOutput: executionResult.outputSummary
        };
      },
      getState() {
        return {
          agentId: 'gongbu-task-1',
          role: 'executor',
          goal: '执行代码任务',
          plan: [],
          toolCalls: [],
          observations: [],
          shortTermMemory: [],
          longTermMemoryRefs: [],
          status: 'completed'
        };
      }
    };
    const opsMinistry: OpsExecutionMinistryLike = {
      async execute() {
        return {
          ...codeExecutionResult,
          toolName: 'run_terminal',
          summary: '兵部已完成受控运维执行。'
        };
      },
      getState() {
        return {
          agentId: 'bingbu-task-1',
          role: 'executor',
          goal: '执行运维任务',
          plan: [],
          toolCalls: [],
          observations: [],
          shortTermMemory: [],
          longTermMemoryRefs: [],
          status: 'completed'
        };
      }
    };
    const approvedExecutor: ApprovedExecutionAgentLike = {
      getState() {
        return {
          agentId: 'executor-task-1',
          role: 'executor',
          goal: '审批后执行',
          plan: [],
          toolCalls: [],
          observations: [],
          shortTermMemory: [],
          longTermMemoryRefs: [],
          status: 'completed'
        };
      }
    };

    await expect(researchMinistry.research('继续研究当前问题')).resolves.toEqual(researchResult);
    await expect(deliveryMinistry.research(task)).resolves.toEqual(deliveryResearchResult);
    await expect(deliveryMinistry.execute(task, '当前执行摘要')).resolves.toEqual(
      expect.objectContaining({
        toolName: 'documentation',
        requiresApproval: false
      })
    );
    await expect(reviewMinistry.review(undefined, '当前执行摘要')).resolves.toEqual(reviewResult);
    await expect(codeMinistry.execute('继续执行当前任务', '继续研究当前问题')).resolves.toEqual(codeExecutionResult);
    await expect(opsMinistry.execute('继续执行当前任务', '继续研究当前问题')).resolves.toEqual(
      expect.objectContaining({ toolName: 'run_terminal' })
    );
    expect(
      codeMinistry.buildApprovedState(
        {
          ok: true,
          outputSummary: '审批后执行完成',
          durationMs: 1,
          exitCode: 0
        },
        {
          taskId: 'task-1',
          intent: 'read_file',
          toolName: 'local-analysis',
          researchSummary: '继续研究当前问题'
        }
      ).status
    ).toBe('completed');
    expect(approvedExecutor.getState().role).toBe('executor');
    expect(deliveryMinistry.review(task, '当前执行摘要').review.decision).toBe('approved');
    expect(deliveryMinistry.buildDelivery(task, '当前执行摘要')).toContain('最终交付');
  });
});
