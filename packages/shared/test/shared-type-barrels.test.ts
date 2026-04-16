import { describe, expect, it } from 'vitest';

import {
  AgentExecutionStateSchema,
  AgentMessageRecordSchema,
  ApprovalRecordSchema,
  ChannelIdentitySchema,
  CheckpointRefSchema,
  ChatCheckpointRecordSchema,
  ChatEventRecordSchema,
  ChatMessageRecordSchema,
  ChatSessionRecordSchema,
  ChatThinkStateSchema,
  ChatThoughtChainItemSchema,
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextSliceRecordSchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  DispatchInstructionSchema,
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  LlmUsageRecordSchema,
  MicroLoopStateRecordSchema,
  PartialAggregationRecordSchema,
  ThoughtGraphRecordSchema,
  PlanDraftRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema,
  TaskBackgroundLearningStateSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointStreamStatusSchema,
  TaskRecordSchema,
  ThoughtGraphEdgeSchema,
  ThoughtGraphNodeSchema,
  TaskModeGateStateSchema,
  isCitationEvidenceSource
} from '../src';
import type {
  AgentMessage,
  ChannelIdentity,
  CheckpointRef,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatThinkState,
  ChatThoughtChainItem,
  TaskRecord,
  ThoughtGraphRecord,
  EvidenceRecord,
  ExecutionTrace,
  HealthCheckResult,
  LearningQueueItem,
  PlanDraftRecord,
  RuntimeCenterRecord,
  SkillCard
} from '../src';

describe('@agent/shared type barrels', () => {
  it('keeps knowledge and tasking barrels stable after file splits', () => {
    const trace: ExecutionTrace = {
      node: 'runtime.governance',
      at: '2026-04-15T00:00:00.000Z',
      summary: 'governance check completed',
      status: 'success'
    };
    const evidence: EvidenceRecord = {
      id: 'evidence-1',
      taskId: 'task-1',
      sourceType: 'document',
      trustClass: 'internal',
      summary: 'runtime contract document',
      createdAt: '2026-04-15T00:00:00.000Z'
    };
    const queueItem: LearningQueueItem = {
      id: 'learning-1',
      taskId: 'task-1',
      status: 'queued',
      trace: [trace],
      queuedAt: '2026-04-15T00:00:00.000Z',
      updatedAt: '2026-04-15T00:00:00.000Z'
    };
    const skill: SkillCard = {
      id: 'skill-1',
      name: 'Runtime Audit',
      description: 'Audit runtime contracts',
      applicableGoals: ['audit runtime'],
      requiredTools: ['filesystem.read'],
      steps: [{ title: 'Read', instruction: 'Inspect runtime docs', toolNames: ['filesystem.read'] }],
      constraints: ['do not mutate state'],
      successSignals: ['contracts aligned'],
      riskLevel: 'medium',
      source: 'task-learning',
      status: 'lab',
      createdAt: '2026-04-15T00:00:00.000Z',
      updatedAt: '2026-04-15T00:00:00.000Z'
    };
    const health: HealthCheckResult = {
      status: 'ok',
      service: 'agent-server',
      now: '2026-04-15T00:00:00.000Z'
    };
    const runtime: RuntimeCenterRecord = {
      taskCount: 1,
      activeTaskCount: 1,
      queueDepth: 0,
      blockedRunCount: 0,
      pendingApprovalCount: 0,
      sessionCount: 1,
      activeSessionCount: 1,
      activeMinistries: ['gongbu'],
      activeWorkers: ['worker-1'],
      usageAnalytics: {
        totalEstimatedPromptTokens: 0,
        totalEstimatedCompletionTokens: 0,
        totalEstimatedTokens: 0,
        totalEstimatedCostUsd: 0,
        totalEstimatedCostCny: 0,
        providerMeasuredCostUsd: 0,
        providerMeasuredCostCny: 0,
        estimatedFallbackCostUsd: 0,
        estimatedFallbackCostCny: 0,
        measuredRunCount: 0,
        estimatedRunCount: 0,
        daily: [],
        models: [],
        budgetPolicy: {
          dailyTokenWarning: 1000,
          dailyCostCnyWarning: 100,
          totalCostCnyWarning: 500
        },
        alerts: []
      },
      recentRuns: []
    };

    expect(queueItem.trace[0]?.summary).toBe('governance check completed');
    expect(isCitationEvidenceSource(evidence)).toBe(true);
    expect(skill.status).toBe('lab');
    expect(health.service).toBe('agent-server');
    expect(runtime.activeMinistries[0]).toBe('gongbu');
  });

  it('re-exports core-backed tasking planning and orchestration contracts through shared', () => {
    const planDraft: PlanDraftRecord = {
      summary: '先读，再执行。',
      autoResolved: [],
      openQuestions: ['是否直接写入'],
      assumptions: ['默认只读']
    };
    const message: AgentMessage = {
      id: 'msg-1',
      taskId: 'task-1',
      from: 'manager',
      to: 'research',
      type: 'dispatch',
      content: '先确认契约来源。',
      createdAt: '2026-04-16T00:00:00.000Z'
    };

    expect(PlanDraftRecordSchema.parse(planDraft).summary).toContain('先读');
    expect(AgentMessageRecordSchema.parse(message).to).toBe('research');
    expect(
      EntryDecisionRecordSchema.parse({
        requestedMode: 'plan',
        selectionReason: 'readonly first'
      }).requestedMode
    ).toBe('plan');
    expect(
      ExecutionPlanRecordSchema.parse({
        mode: 'execute',
        dispatchChain: ['entry_router', 'result_aggregator']
      }).mode
    ).toBe('execute');
    expect(
      PartialAggregationRecordSchema.parse({
        kind: 'preview',
        summary: '先给预览',
        requiresApproval: false,
        allowedCapabilities: ['filesystem.read'],
        createdAt: '2026-04-16T00:00:00.000Z'
      }).kind
    ).toBe('preview');
    expect(
      DispatchInstructionSchema.parse({
        taskId: 'task-1',
        subTaskId: 'sub-1',
        from: 'manager',
        to: 'research',
        kind: 'strategy',
        objective: '先补证据'
      }).kind
    ).toBe('strategy');
    expect(
      SpecialistLeadRecordSchema.parse({
        id: 'technical-architecture',
        displayName: 'Architecture',
        domain: 'technical-architecture'
      }).domain
    ).toBe('technical-architecture');
    expect(
      SpecialistSupportRecordSchema.parse({
        id: 'risk-compliance',
        displayName: 'Risk',
        domain: 'risk-compliance'
      }).displayName
    ).toBe('Risk');
    expect(
      SpecialistFindingRecordSchema.parse({
        specialistId: 'technical-architecture',
        role: 'lead',
        contractVersion: 'specialist-finding.v1',
        source: 'research',
        stage: 'planning',
        summary: '建议先收紧 contract',
        domain: 'technical-architecture'
      }).role
    ).toBe('lead');
    expect(
      ContextSliceRecordSchema.parse({
        specialistId: 'technical-architecture',
        recentTurns: [{ role: 'user', content: '继续' }]
      }).recentTurns?.[0]?.role
    ).toBe('user');
    expect(
      CritiqueResultRecordSchema.parse({
        contractVersion: 'critique-result.v1',
        decision: 'pass',
        summary: '结构稳定'
      }).decision
    ).toBe('pass');
    expect(
      BudgetGateStateRecordSchema.parse({
        node: 'budget_gate',
        status: 'open',
        summary: '预算门就绪',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).node
    ).toBe('budget_gate');
    expect(
      ComplexTaskPlanRecordSchema.parse({
        node: 'complex_task_plan',
        status: 'pending',
        summary: '等待拆解',
        subGoals: ['收紧 contract'],
        dependencies: [],
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).status
    ).toBe('pending');
    expect(
      BlackboardStateRecordSchema.parse({
        node: 'blackboard_state',
        taskId: 'task-1',
        visibleScopes: ['supervisor', 'strategy'],
        refs: { traceCount: 0, evidenceCount: 0 },
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).refs.traceCount
    ).toBe(0);
    expect(
      MicroLoopStateRecordSchema.parse({
        state: 'idle',
        attempt: 0,
        maxAttempts: 2,
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).maxAttempts
    ).toBe(2);
    expect(
      CurrentSkillExecutionRecordSchema.parse({
        skillId: 'skill-1',
        displayName: 'Runtime Audit',
        phase: 'research',
        stepIndex: 1,
        totalSteps: 2,
        title: 'Read docs',
        instruction: 'Inspect docs',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).phase
    ).toBe('research');
    expect(
      GovernanceScoreRecordSchema.parse({
        ministry: 'libu-governance',
        score: 88,
        status: 'healthy',
        summary: '稳定',
        rationale: ['终审通过'],
        recommendedLearningTargets: ['memory'],
        trustAdjustment: 'promote',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).trustAdjustment
    ).toBe('promote');
    expect(
      GovernanceReportRecordSchema.parse({
        ministry: 'libu-governance',
        summary: '稳定',
        executionQuality: { score: 88, summary: '良好' },
        evidenceSufficiency: { score: 82, summary: '足够' },
        sandboxReliability: { score: 75, summary: '稳定' },
        reviewOutcome: { decision: 'pass', summary: '可交付' },
        interruptLoad: { interruptCount: 0, microLoopCount: 0, summary: '平稳' },
        businessFeedback: { score: 80, summary: '满足需求' },
        recommendedLearningTargets: ['memory'],
        trustAdjustment: 'promote',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).reviewOutcome.decision
    ).toBe('pass');
    expect(
      LlmUsageRecordSchema.parse({
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
        estimated: false,
        measuredCallCount: 1,
        estimatedCallCount: 0,
        models: [],
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).totalTokens
    ).toBe(3);
  });

  it('re-exports core-backed chat and task runtime state contracts through shared', () => {
    const event: ChatEventRecord = {
      id: 'event-1',
      sessionId: 'session-1',
      type: 'assistant_message',
      at: '2026-04-16T00:00:00.000Z',
      payload: {
        checkpointId: 'checkpoint-1'
      }
    };
    const thought: ChatThoughtChainItem = {
      key: 'evidence',
      title: '整理证据',
      status: 'loading'
    };
    const think: ChatThinkState = {
      title: '正在归并上下文',
      content: '先确认来源，再补执行计划。'
    };

    expect(ChatEventRecordSchema.parse(event).payload.checkpointId).toBe('checkpoint-1');
    expect(ChatThoughtChainItemSchema.parse(thought).status).toBe('loading');
    expect(ChatThinkStateSchema.parse(think).title).toContain('归并');
    expect(
      TaskModeGateStateSchema.parse({
        activeMode: 'plan',
        reason: 'awaiting clarification',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).activeMode
    ).toBe('plan');
    expect(
      TaskBackgroundLearningStateSchema.parse({
        status: 'completed',
        mode: 'dream-task',
        finishedAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).mode
    ).toBe('dream-task');
    expect(
      TaskCheckpointGraphStateSchema.parse({
        status: 'blocked',
        currentStep: 'approval_pending'
      }).status
    ).toBe('blocked');
    expect(
      TaskCheckpointStreamStatusSchema.parse({
        nodeLabel: '工部',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).nodeLabel
    ).toBe('工部');
    expect(
      TaskCheckpointCursorStateSchema.parse({
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0
      }).learningCursor
    ).toBe(0);
  });

  it('re-exports core-backed checkpoint thought graph contracts through shared', () => {
    const checkpointRef: CheckpointRef = {
      sessionId: 'session-1',
      checkpointId: 'checkpoint-1',
      checkpointCursor: 0,
      recoverability: 'safe'
    };

    expect(CheckpointRefSchema.parse(checkpointRef).recoverability).toBe('safe');
    expect(
      ThoughtGraphNodeSchema.parse({
        id: 'node-1',
        kind: 'review',
        label: '审查中',
        status: 'completed'
      }).label
    ).toBe('审查中');
    expect(
      ThoughtGraphEdgeSchema.parse({
        from: 'node-1',
        to: 'node-2',
        reason: '继续'
      }).reason
    ).toBe('继续');
    const graph: ThoughtGraphRecord = {
      nodes: [
        {
          id: 'node-1',
          kind: 'execution',
          label: '执行中',
          status: 'running'
        }
      ],
      edges: []
    };
    expect(ThoughtGraphRecordSchema.parse(graph).nodes[0]?.kind).toBe('execution');
  });

  it('re-exports the core-backed shared chat message contract through shared', () => {
    const message: ChatMessageRecord = {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '请确认计划问题。',
      card: {
        type: 'approval_request',
        intent: 'edit file',
        toolName: 'filesystem.write',
        approvalScope: 'once'
      },
      createdAt: '2026-04-16T00:00:00.000Z'
    };

    expect(ChatMessageRecordSchema.parse(message).card?.type).toBe('approval_request');
  });

  it('re-exports the core-backed chat session and channel identity contracts through shared', () => {
    const identity: ChannelIdentity = {
      channel: 'web',
      channelUserId: 'user-1'
    };
    const session: ChatSessionRecord = {
      id: 'session-1',
      title: 'Runtime contract audit',
      status: 'idle',
      channelIdentity: identity,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };

    expect(ChannelIdentitySchema.parse(identity).channelUserId).toBe('user-1');
    expect(ChatSessionRecordSchema.parse(session).status).toBe('idle');
  });

  it('re-exports the core-backed checkpoint and task record contracts through shared', () => {
    const approval = ApprovalRecordSchema.parse({
      taskId: 'task-1',
      intent: 'write_file',
      decision: 'pending',
      decidedAt: '2026-04-16T00:00:00.000Z'
    });
    const agentState = AgentExecutionStateSchema.parse({
      agentId: 'agent-1',
      role: 'executor',
      goal: 'edit runtime module',
      plan: ['update helper'],
      toolCalls: ['filesystem.write'],
      observations: [],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'waiting_approval'
    });
    const checkpoint: ChatCheckpointRecord = {
      checkpointId: 'checkpoint-1',
      sessionId: 'session-1',
      taskId: 'task-1',
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      graphState: { status: 'running' },
      pendingApprovals: [approval],
      agentStates: [agentState],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };
    const task: TaskRecord = {
      id: 'task-1',
      goal: '收口 tasking contract',
      status: 'running',
      trace: [],
      approvals: [approval],
      agentStates: [agentState],
      messages: [],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };

    expect(ChatCheckpointRecordSchema.parse(checkpoint).agentStates[0]?.role).toBe('executor');
    expect(TaskRecordSchema.parse(task).approvals[0]?.intent).toBe('write_file');
  });
});
