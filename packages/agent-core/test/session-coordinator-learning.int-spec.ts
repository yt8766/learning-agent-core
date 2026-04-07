import { describe, expect, it } from 'vitest';

import { TaskStatus } from '@agent/shared';

import { SessionCoordinator } from '../src/session/session-coordinator';
import {
  createLlmProvider,
  createOrchestrator,
  createRuntimeRepository,
  flushAsyncWork
} from './session-coordinator.test.utils';

describe('SessionCoordinator learning confirmation integration', () => {
  it('confirms selected learning candidates and records the learning_confirmed event', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '学习确认', message: '请学习本轮经验' });
    await flushAsyncWork();

    const task = {
      id: 'task-1',
      status: TaskStatus.COMPLETED,
      learningCandidates: [
        {
          id: 'memory-1',
          taskId: 'task-1',
          type: 'memory',
          summary: '记录用户对连续对话的偏好',
          status: 'pending_confirmation',
          payload: { id: 'memory-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        },
        {
          id: 'rule-1',
          taskId: 'task-1',
          type: 'rule',
          summary: '后续回复优先承接上文',
          status: 'pending_confirmation',
          payload: { id: 'rule-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      updatedAt: '2026-03-22T00:00:00.000Z'
    };
    orchestrator.getTask.mockReturnValue(task);

    const result = await coordinator.confirmLearning(session.id, {
      actor: 'tester',
      sessionId: session.id,
      candidateIds: ['memory-1', 'rule-1']
    });

    expect(result.status).toBe('completed');
    expect(orchestrator.confirmLearning).toHaveBeenCalledWith('task-1', ['memory-1', 'rule-1']);
    expect(task.learningCandidates.every((candidate: any) => candidate.status === 'confirmed')).toBe(true);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'learning_confirmed',
          payload: expect.objectContaining({
            taskId: 'task-1',
            candidateIds: ['memory-1', 'rule-1'],
            autoConfirmed: false
          })
        })
      ])
    );
  });

  it('auto-confirms eligible learning candidates after a completed turn and keeps the session completed', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    orchestrator.createTask.mockImplementation(async dto => {
      const task = {
        id: 'task-auto-learn-1',
        goal: dto.goal,
        sessionId: dto.sessionId,
        status: TaskStatus.COMPLETED,
        trace: [],
        approvals: [],
        agentStates: [],
        messages: [
          {
            id: 'task-msg-auto-learn-1',
            taskId: 'task-auto-learn-1',
            from: 'manager',
            to: 'manager',
            type: 'summary',
            content: '已记住你偏好的对话方式。',
            createdAt: '2026-03-22T00:00:01.000Z'
          }
        ],
        learningCandidates: [
          {
            id: 'pref-1',
            taskId: 'task-auto-learn-1',
            type: 'memory',
            summary: '用户偏好主聊天区直接承接多轮上下文',
            status: 'pending_confirmation',
            autoConfirmEligible: true,
            payload: { id: 'mem-pref-1' },
            createdAt: '2026-03-22T00:00:00.000Z'
          }
        ],
        learningEvaluation: {
          score: 92,
          confidence: 'high',
          notes: ['检测到稳定偏好，已进入自动学习。'],
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          recommendedCandidateIds: ['pref-1'],
          autoConfirmCandidateIds: ['pref-1'],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 1,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        result: '已记住你偏好的对话方式。',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z',
        currentStep: 'finish',
        retryCount: 0,
        maxRetries: 1
      };

      orchestrator.getTask.mockReturnValue(task);
      return task;
    });

    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '自动学习', message: '记住我偏好多轮连续回答' });
    await flushAsyncWork(8);

    expect(orchestrator.confirmLearning).toHaveBeenCalledWith('task-auto-learn-1', ['pref-1']);
    expect(coordinator.getSession(session.id)?.status).toBe('completed');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'learning_confirmed',
          payload: expect.objectContaining({
            taskId: 'task-auto-learn-1',
            candidateIds: ['pref-1'],
            autoConfirmed: true
          })
        })
      ])
    );
  });
});
