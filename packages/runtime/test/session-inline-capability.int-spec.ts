import { describe, expect, it } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/shared';
import type { RuntimeStateRepository, RuntimeStateSnapshot } from '@agent/memory';

import { SessionCoordinator } from '../src/session/session-coordinator';

function createEmptyRuntimeState(): RuntimeStateSnapshot {
  return {
    tasks: [],
    learningJobs: [],
    learningQueue: [],
    pendingExecutions: [],
    channelDeliveries: [],
    chatSessions: [],
    chatMessages: [],
    chatEvents: [],
    chatCheckpoints: [],
    crossCheckEvidence: [],
    governance: {
      disabledSkillSourceIds: [],
      disabledCompanyWorkerIds: [],
      disabledConnectorIds: [],
      configuredConnectors: [],
      connectorDiscoveryHistory: [],
      connectorPolicyOverrides: [],
      capabilityPolicyOverrides: [],
      capabilityGovernanceProfiles: [],
      ministryGovernanceProfiles: [],
      workerGovernanceProfiles: [],
      specialistGovernanceProfiles: [],
      counselorSelectorConfigs: [],
      approvalScopePolicies: [],
      learningConflictScan: {
        scannedAt: '',
        conflictPairs: [],
        mergeSuggestions: [],
        manualReviewQueue: []
      }
    },
    governanceAudit: [],
    usageHistory: [],
    evalHistory: [],
    usageAudit: []
  };
}

class InMemoryRuntimeStateRepository implements RuntimeStateRepository {
  snapshot = createEmptyRuntimeState();

  async load(): Promise<RuntimeStateSnapshot> {
    return this.snapshot;
  }

  async save(snapshot: RuntimeStateSnapshot): Promise<void> {
    this.snapshot = snapshot;
  }
}

function createSessionOrchestratorStub() {
  return {
    async initialize() {},
    async cancelTask() {
      return null;
    },
    subscribe() {
      return () => {};
    },
    subscribeTokens() {
      return () => {};
    }
  };
}

describe('@agent/runtime session inline capability integration', () => {
  it('persists session, messages, events and checkpoint for inline capability replies', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const coordinator = new SessionCoordinator(createSessionOrchestratorStub() as never, repository, {} as never);

    const session = await coordinator.createSession({});

    expect(session.title).toBe('新会话');
    expect(coordinator.getEvents(session.id)).toHaveLength(1);

    const userMessage = await coordinator.appendInlineCapabilityResponse(
      session.id,
      {
        message: '帮我总结 runtime approval recovery 的当前状态'
      },
      {
        content: 'approval recovery 主链已经具备最小 integration 覆盖。'
      }
    );

    const persistedSession = coordinator.getSession(session.id);
    const messages = coordinator.getMessages(session.id);
    const events = coordinator.getEvents(session.id);
    const checkpoint = coordinator.getCheckpoint(session.id);

    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toBe('帮我总结 runtime approval recovery 的当前状态');
    expect(persistedSession?.title).toBe('帮我总结 runtime approval recovery 的当前状态');
    expect(persistedSession?.status).toBe('completed');
    expect(messages.map(item => item.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.content).toBe('approval recovery 主链已经具备最小 integration 覆盖。');
    expect(events.map(item => item.type)).toEqual([
      'session_started',
      'user_message',
      'assistant_message',
      'final_response_completed'
    ]);
    expect(checkpoint).toMatchObject({
      taskId: `inline-capability:${session.id}`,
      pendingApprovals: []
    });
    expect(checkpoint?.graphState).toMatchObject({
      status: 'completed'
    });

    expect(repository.snapshot.chatSessions).toHaveLength(1);
    expect(repository.snapshot.chatMessages).toHaveLength(2);
    expect(repository.snapshot.chatEvents).toHaveLength(4);
    expect(repository.snapshot.chatCheckpoints).toHaveLength(1);
  });

  it('recovers a session back to a checkpoint cursor and restores waiting approval state', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const coordinator = new SessionCoordinator(createSessionOrchestratorStub() as never, repository, {} as never);

    const session = await coordinator.createSession({});
    await coordinator.appendInlineCapabilityResponse(
      session.id,
      {
        message: '先记录一个可恢复的最小会话'
      },
      {
        content: '已经生成最小闭环响应。'
      }
    );

    const checkpoint = coordinator.getCheckpoint(session.id);
    expect(checkpoint).toBeDefined();

    checkpoint!.traceCursor = 7;
    checkpoint!.messageCursor = 6;
    checkpoint!.approvalCursor = 5;
    checkpoint!.learningCursor = 4;
    checkpoint!.graphState = {
      ...checkpoint!.graphState,
      status: TaskStatus.WAITING_APPROVAL
    };
    checkpoint!.pendingApproval = {
      toolName: 'filesystem',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'gongbu-code',
      reason: '等待人工审批后继续写文件'
    };

    const recovered = await coordinator.recoverToCheckpoint(session.id, {
      sessionId: session.id,
      checkpointId: checkpoint!.checkpointId,
      checkpointCursor: 3,
      reason: '用户要求回退到审批前检查点'
    });

    const refreshedCheckpoint = coordinator.getCheckpoint(session.id);
    const events = coordinator.getEvents(session.id);

    expect(recovered.status).toBe('waiting_approval');
    expect(refreshedCheckpoint).toMatchObject({
      traceCursor: 3,
      messageCursor: 3,
      approvalCursor: 3,
      learningCursor: 3,
      recoverability: 'partial'
    });
    expect(events.at(-1)).toMatchObject({
      type: 'session_started',
      payload: {
        recovered: true,
        checkpointId: checkpoint!.checkpointId,
        checkpointCursor: 3,
        reason: '用户要求回退到审批前检查点'
      }
    });
    expect(repository.snapshot.chatCheckpoints[0]).toMatchObject({
      traceCursor: 3,
      recoverability: 'partial'
    });
  });

  it('cancels a session using checkpoint fallback when no runtime task is available', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const coordinator = new SessionCoordinator(createSessionOrchestratorStub() as never, repository, {} as never);

    const session = await coordinator.createSession({});
    await coordinator.appendInlineCapabilityResponse(
      session.id,
      {
        message: '准备取消当前最小闭环会话'
      },
      {
        content: '当前会话已经产生 checkpoint。'
      }
    );

    const storedSession = coordinator.getSession(session.id);
    const checkpoint = coordinator.getCheckpoint(session.id);

    storedSession!.status = 'running';
    storedSession!.currentTaskId = checkpoint!.taskId;
    checkpoint!.graphState = {
      ...checkpoint!.graphState,
      status: TaskStatus.RUNNING
    };
    checkpoint!.pendingApproval = {
      toolName: 'filesystem',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'gongbu-code',
      reason: '等待取消测试'
    };

    const cancelled = await coordinator.cancel(session.id, {
      reason: '人工终止本轮最小闭环'
    });

    const refreshedCheckpoint = coordinator.getCheckpoint(session.id);
    const events = coordinator.getEvents(session.id);
    const messages = coordinator.getMessages(session.id);

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.currentTaskId).toBeUndefined();
    expect(refreshedCheckpoint?.graphState).toMatchObject({
      status: TaskStatus.CANCELLED,
      currentStep: 'cancelled'
    });
    expect(refreshedCheckpoint?.pendingApproval).toBeUndefined();
    expect(events.at(-1)).toMatchObject({
      type: 'run_cancelled',
      payload: {
        summary: '执行已终止：人工终止本轮最小闭环'
      }
    });
    expect(messages.at(-1)?.role).toBe('system');
    expect(messages.at(-1)?.content).toBe('已终止当前执行：人工终止本轮最小闭环');
    expect(repository.snapshot.chatSessions[0]?.status).toBe('cancelled');
  });
});
