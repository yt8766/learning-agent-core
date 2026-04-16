import { describe, expect, it } from 'vitest';

import type {
  ApprovalDecisionRecord,
  ApprovalScopePolicyRecord,
  ConnectorCapabilityUsageRecord,
  ConnectorHealthRecord,
  ConnectorKnowledgeIngestionSummary,
  DeliveryCitationRecord,
  DeliverySourceSummaryRecord,
  EvidenceRecord,
  ExecutionTrace,
  HealthCheckResult,
  LlmUsageRecord,
  QueueStateRecord,
  MemoryRecord,
  McpCapability,
  PlatformApprovalRecord,
  PlanDraftRecord,
  PlanQuestionRecord,
  ManagerPlan,
  AgentMessageRecord,
  AgentExecutionState,
  ChatEventRecord,
  ChatCheckpointRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatThinkState,
  ChatThoughtChainItem,
  CheckpointRef,
  ApprovalRecord,
  ThoughtGraphRecord,
  ThoughtGraphEdge,
  ThoughtGraphNode,
  TaskRecord,
  RuleRecord,
  SharedPlatformConsoleRecord
} from '../src';
import {
  AgentExecutionStateSchema,
  AgentMessageRecordSchema,
  ApprovalRecordSchema,
  ChatCheckpointRecordSchema,
  ChatEventRecordSchema,
  ChatMessageRecordSchema,
  ChatSessionRecordSchema,
  ChatThinkStateSchema,
  ChatThoughtChainItemSchema,
  ApprovalPolicyRecordSchema,
  ApprovalScopePolicyRecordSchema,
  buildApprovalScopeMatchKey,
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextSliceRecordSchema,
  ConnectorCapabilityUsageRecordSchema,
  ConnectorHealthRecordSchema,
  ConnectorKnowledgeIngestionSummarySchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  DispatchInstructionSchema,
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  HealthCheckResultSchema,
  isCitationEvidenceSource,
  LlmUsageRecordSchema,
  ManagerPlanSchema,
  MemoryEventRecordSchema,
  MemoryRecordSchema,
  MemorySearchRequestSchema,
  MemorySearchResultSchema,
  PartialAggregationRecordSchema,
  PlanDraftRecordSchema,
  PlanQuestionRecordSchema,
  ReflectionRecordSchema,
  ResolutionCandidateRecordSchema,
  McpCapabilitySchema,
  QueueStateRecordSchema,
  MicroLoopStateRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema,
  TaskBackgroundLearningStateSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointStreamStatusSchema,
  TaskModeGateStateSchema,
  ChannelIdentitySchema,
  CheckpointRefSchema,
  ThoughtGraphRecordSchema,
  ThoughtGraphEdgeSchema,
  ThoughtGraphNodeSchema,
  TaskRecordSchema,
  UserProfileRecordSchema,
  matchesApprovalScopePolicy
} from '../src';

describe('@agent/core type contracts', () => {
  it('keeps connector knowledge ingestion summary stable', () => {
    const summary: ConnectorKnowledgeIngestionSummary = {
      sourceCount: 2,
      searchableDocumentCount: 10,
      blockedDocumentCount: 1,
      latestReceiptIds: ['receipt-1']
    };

    expect(summary).toEqual({
      sourceCount: 2,
      searchableDocumentCount: 10,
      blockedDocumentCount: 1,
      latestReceiptIds: ['receipt-1']
    });
  });

  it('parses connector summary and usage contracts from schema-first core definitions', () => {
    expect(
      ConnectorKnowledgeIngestionSummarySchema.parse({
        sourceCount: 2,
        searchableDocumentCount: 10,
        blockedDocumentCount: 1,
        latestReceiptIds: ['receipt-1']
      }).searchableDocumentCount
    ).toBe(10);

    expect(
      ConnectorCapabilityUsageRecordSchema.parse({
        taskId: 'task-1',
        goal: 'audit runtime connectors',
        status: 'completed',
        approvalCount: 1,
        latestTraceSummary: 'connector policy passed'
      }).approvalCount
    ).toBe(1);
  });

  it('keeps delivery source summary and connector capability usage contract stable', () => {
    const citation: DeliveryCitationRecord = {
      label: 'runtime-guideline',
      sourceType: 'repo-docs',
      trustClass: 'internal',
      summary: 'latest architecture note'
    };
    const delivery: DeliverySourceSummaryRecord = {
      freshnessSourceSummary: 'repo docs refreshed',
      citationSourceSummary: '1 controlled source',
      citations: [citation]
    };
    const usage: ConnectorCapabilityUsageRecord = {
      taskId: 'task-1',
      goal: 'audit runtime connectors',
      status: 'completed',
      approvalCount: 1,
      latestTraceSummary: 'connector policy passed'
    };

    expect(delivery.citations?.[0]?.label).toBe('runtime-guideline');
    expect(usage).toMatchObject({
      taskId: 'task-1',
      approvalCount: 1
    });
  });

  it('keeps platform console approval contracts stable', () => {
    const decision: ApprovalDecisionRecord = {
      decision: 'approved',
      reason: 'low risk'
    };
    const approval: PlatformApprovalRecord = {
      taskId: 'task-42',
      goal: 'review governance policy',
      status: 'pending_approval',
      executionMode: 'plan',
      approvals: [decision],
      activeInterrupt: {
        id: 'interrupt-1',
        status: 'pending',
        mode: 'blocking',
        source: 'tool',
        kind: 'runtime-governance',
        resumeStrategy: 'approval-recovery'
      }
    };
    const consoleRecord: SharedPlatformConsoleRecord<{ taskCount: number }> = {
      runtime: { taskCount: 1 },
      approvals: [approval],
      learning: null,
      evals: null,
      skills: [],
      evidence: [],
      connectors: [],
      skillSources: null,
      companyAgents: [],
      rules: [],
      tasks: [],
      sessions: []
    };

    expect(consoleRecord.approvals[0]?.activeInterrupt?.kind).toBe('runtime-governance');
    expect(consoleRecord.runtime.taskCount).toBe(1);
  });

  it('keeps governance match key and connector contracts stable', () => {
    const policy: ApprovalScopePolicyRecord = {
      id: 'policy-1',
      scope: 'session',
      status: 'active',
      matchKey: buildApprovalScopeMatchKey({
        intent: 'edit file',
        toolName: 'filesystem.write',
        requestedBy: 'worker'
      }),
      createdAt: '2026-04-15T00:00:00.000Z',
      updatedAt: '2026-04-15T00:00:00.000Z'
    };
    const health: ConnectorHealthRecord = {
      connectorId: 'github',
      healthState: 'healthy',
      checkedAt: '2026-04-15T00:00:00.000Z'
    };
    const capability: McpCapability = {
      id: 'cap-1',
      toolName: 'filesystem.write',
      serverId: 'mcp-local',
      displayName: 'Filesystem Write',
      riskLevel: 'medium',
      requiresApproval: true,
      category: 'system'
    };

    expect(
      matchesApprovalScopePolicy(policy, {
        intent: 'edit file',
        toolName: 'filesystem.write',
        requestedBy: 'worker'
      })
    ).toBe(true);
    expect(health.healthState).toBe('healthy');
    expect(capability.category).toBe('system');
  });

  it('parses governance contracts from schema-first core definitions', () => {
    expect(
      ConnectorHealthRecordSchema.parse({
        connectorId: 'github',
        healthState: 'healthy',
        checkedAt: '2026-04-15T00:00:00.000Z'
      }).connectorId
    ).toBe('github');

    expect(
      ApprovalPolicyRecordSchema.parse({
        id: 'policy-1',
        scope: 'connector',
        targetId: 'github',
        mode: 'require-approval',
        reason: 'connector writes'
      }).scope
    ).toBe('connector');

    expect(
      ApprovalScopePolicyRecordSchema.parse({
        id: 'scope-1',
        scope: 'session',
        status: 'active',
        matchKey: buildApprovalScopeMatchKey({
          intent: 'edit file',
          toolName: 'filesystem.write'
        }),
        createdAt: '2026-04-15T00:00:00.000Z',
        updatedAt: '2026-04-15T00:00:00.000Z'
      }).status
    ).toBe('active');

    expect(
      McpCapabilitySchema.parse({
        id: 'cap-1',
        toolName: 'filesystem.write',
        serverId: 'mcp-local',
        displayName: 'Filesystem Write',
        riskLevel: 'medium',
        requiresApproval: true,
        category: 'system'
      }).displayName
    ).toBe('Filesystem Write');
  });

  it('keeps tasking health-check contracts stable in core', () => {
    const health: HealthCheckResult = {
      status: 'ok',
      service: 'agent-server',
      now: '2026-04-15T00:00:00.000Z'
    };

    expect(health).toEqual({
      status: 'ok',
      service: 'agent-server',
      now: '2026-04-15T00:00:00.000Z'
    });
  });

  it('parses chat event and thinking contracts from schema-first core definitions', () => {
    const event: ChatEventRecord = {
      id: 'event-1',
      sessionId: 'session-1',
      type: 'assistant_message',
      at: '2026-04-16T00:00:00.000Z',
      payload: {
        taskId: 'task-1'
      }
    };
    const thought: ChatThoughtChainItem = {
      key: 'plan',
      title: '生成执行计划',
      status: 'success'
    };
    const think: ChatThinkState = {
      title: '正在分析',
      content: '先读取上下文，再决定是否执行。',
      loading: true
    };

    expect(ChatEventRecordSchema.parse(event).type).toBe('assistant_message');
    expect(ChatThoughtChainItemSchema.parse(thought).status).toBe('success');
    expect(ChatThinkStateSchema.parse(think).loading).toBe(true);
  });

  it('parses task runtime state contracts from schema-first core definitions', () => {
    expect(
      TaskModeGateStateSchema.parse({
        requestedMode: 'plan',
        activeMode: 'execute',
        reason: 'workflow requires execution',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).activeMode
    ).toBe('execute');

    expect(
      TaskBackgroundLearningStateSchema.parse({
        status: 'queued',
        mode: 'task-learning',
        queuedAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).status
    ).toBe('queued');

    expect(
      TaskCheckpointGraphStateSchema.parse({
        status: 'running',
        currentStep: 'delivery',
        retryCount: 1
      }).status
    ).toBe('running');

    expect(
      TaskCheckpointStreamStatusSchema.parse({
        nodeId: 'delivery',
        nodeLabel: '文书科',
        detail: '正在整理交付',
        progressPercent: 80,
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).nodeLabel
    ).toBe('文书科');

    expect(
      TaskCheckpointCursorStateSchema.parse({
        traceCursor: 3,
        messageCursor: 2,
        approvalCursor: 1,
        learningCursor: 0
      }).messageCursor
    ).toBe(2);
  });

  it('parses shared-facing chat message contracts from schema-first core definitions', () => {
    const message: ChatMessageRecord = {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '需要你确认执行方向。',
      taskId: 'task-1',
      linkedAgent: 'manager',
      card: {
        type: 'plan_question',
        title: '确认执行方向',
        questions: [
          {
            id: 'q-1',
            question: '先做结构化拆分还是先做 contract 收口？',
            questionType: 'direction',
            options: [
              {
                id: 'split-first',
                label: '先拆分',
                description: '先降低复杂度再收口'
              }
            ]
          }
        ]
      },
      createdAt: '2026-04-16T00:00:00.000Z'
    };

    expect(ChatMessageRecordSchema.parse(message).card?.type).toBe('plan_question');
    expect(
      ChatMessageRecordSchema.parse({
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'assistant',
        content: '技能草稿已生成。',
        card: {
          type: 'skill_draft_created',
          skillId: 'skill-1',
          displayName: 'Runtime Audit',
          description: '检查 runtime 契约',
          ownerType: 'workspace',
          scope: 'session',
          status: 'draft',
          enabled: false,
          nextActions: ['review']
        },
        createdAt: '2026-04-16T00:00:00.000Z'
      }).card?.type
    ).toBe('skill_draft_created');
  });

  it('parses chat session and channel identity contracts from schema-first core definitions', () => {
    const session: ChatSessionRecord = {
      id: 'session-1',
      title: 'Runtime contract audit',
      status: 'running',
      currentTaskId: 'task-1',
      channelIdentity: {
        channel: 'web',
        channelUserId: 'user-1'
      },
      compression: {
        summary: '已经完成 tasking contract 第一轮收口。',
        condensedMessageCount: 8,
        condensedCharacterCount: 1200,
        totalCharacterCount: 4200,
        trigger: 'message_count',
        source: 'heuristic',
        previewMessages: [
          {
            role: 'assistant',
            content: '继续迁移到 core。'
          }
        ],
        updatedAt: '2026-04-16T00:00:00.000Z'
      },
      approvalPolicies: {
        sessionAllowRules: [
          {
            id: 'scope-1',
            scope: 'session',
            status: 'active',
            matchKey: 'edit file::filesystem.write::::worker::',
            createdAt: '2026-04-16T00:00:00.000Z',
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        ]
      },
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };

    expect(ChannelIdentitySchema.parse(session.channelIdentity).channel).toBe('web');
    expect(ChatSessionRecordSchema.parse(session).compression?.previewMessages?.[0]?.role).toBe('assistant');
  });

  it('parses checkpoint thought graph contracts from schema-first core definitions', () => {
    const checkpointRef: CheckpointRef = {
      sessionId: 'session-1',
      taskId: 'task-1',
      checkpointId: 'checkpoint-1',
      checkpointCursor: 3,
      recoverability: 'partial'
    };
    const node: ThoughtGraphNode = {
      id: 'node-1',
      kind: 'planning',
      label: '规划中',
      status: 'running',
      checkpointRef
    };
    const edge: ThoughtGraphEdge = {
      from: 'node-1',
      to: 'node-2',
      reason: '进入执行'
    };

    expect(CheckpointRefSchema.parse(checkpointRef).recoverability).toBe('partial');
    expect(ThoughtGraphNodeSchema.parse(node).kind).toBe('planning');
    expect(ThoughtGraphEdgeSchema.parse(edge).to).toBe('node-2');

    const graph: ThoughtGraphRecord = {
      nodes: [node],
      edges: [edge]
    };
    expect(ThoughtGraphRecordSchema.parse(graph).nodes[0]?.id).toBe('node-1');
  });

  it('parses checkpoint and task record contracts from schema-first core definitions', () => {
    const approval: ApprovalRecord = {
      taskId: 'task-1',
      intent: 'write_file',
      decision: 'pending',
      decidedAt: '2026-04-16T00:00:00.000Z'
    };
    const agentState: AgentExecutionState = {
      agentId: 'agent-1',
      role: 'research',
      goal: 'collect evidence',
      plan: ['search docs'],
      toolCalls: ['filesystem.read'],
      observations: ['found runtime notes'],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'running'
    };
    const checkpoint: ChatCheckpointRecord = {
      checkpointId: 'checkpoint-1',
      sessionId: 'session-1',
      taskId: 'task-1',
      traceCursor: 1,
      messageCursor: 1,
      approvalCursor: 1,
      learningCursor: 0,
      graphState: {
        status: 'running'
      },
      pendingApprovals: [approval],
      agentStates: [agentState],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };
    const task: TaskRecord = {
      id: 'task-1',
      goal: 'audit runtime contracts',
      status: 'running',
      trace: [],
      approvals: [approval],
      agentStates: [agentState],
      messages: [],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };

    expect(ApprovalRecordSchema.parse(approval).decision).toBe('pending');
    expect(AgentExecutionStateSchema.parse(agentState).role).toBe('research');
    expect(ChatCheckpointRecordSchema.parse(checkpoint).pendingApprovals[0]?.taskId).toBe('task-1');
    expect(TaskRecordSchema.parse(task).goal).toContain('runtime');
  });

  it('parses tasking health-check contract from schema-first core definition', () => {
    expect(
      HealthCheckResultSchema.parse({
        status: 'ok',
        service: 'agent-server',
        now: '2026-04-15T00:00:00.000Z'
      })
    ).toEqual({
      status: 'ok',
      service: 'agent-server',
      now: '2026-04-15T00:00:00.000Z'
    });
  });

  it('keeps planning and orchestration tasking contracts stable in core', () => {
    const question: PlanQuestionRecord = {
      id: 'question-1',
      question: '是否直接执行？',
      questionType: 'direction',
      options: [
        {
          id: 'opt-1',
          label: '执行',
          description: '继续主链执行'
        }
      ]
    };
    const draft: PlanDraftRecord = {
      summary: '先收集上下文，再决定是否执行。',
      autoResolved: [],
      openQuestions: ['是否直接执行'],
      assumptions: ['默认先只读']
    };
    const plan: ManagerPlan = {
      id: 'plan-1',
      goal: 'audit runtime contract host',
      summary: '先锁住 schema，再迁移宿主。',
      steps: ['定义 schema', '更新兼容导出'],
      subTasks: [
        {
          id: 'subtask-1',
          title: '定义 schema',
          description: '把 planning/orchestration 契约搬到 core',
          assignedTo: 'manager',
          status: 'pending'
        }
      ],
      createdAt: '2026-04-16T00:00:00.000Z'
    };
    const message: AgentMessageRecord = {
      id: 'msg-1',
      taskId: 'task-1',
      from: 'manager',
      to: 'research',
      type: 'dispatch',
      content: '请先确认 tasking 契约边界。',
      createdAt: '2026-04-16T00:00:00.000Z'
    };

    expect(question.options[0]?.label).toBe('执行');
    expect(draft.summary).toContain('上下文');
    expect(plan.subTasks[0]?.assignedTo).toBe('manager');
    expect(message.type).toBe('dispatch');
  });

  it('parses planning and orchestration contracts from schema-first core definitions', () => {
    expect(
      PlanQuestionRecordSchema.parse({
        id: 'question-1',
        question: '是否直接执行？',
        questionType: 'direction',
        options: [
          {
            id: 'opt-1',
            label: '执行',
            description: '继续主链执行'
          }
        ]
      }).questionType
    ).toBe('direction');

    expect(
      PlanDraftRecordSchema.parse({
        summary: '先收集上下文，再决定是否执行。',
        autoResolved: [],
        openQuestions: ['是否直接执行'],
        assumptions: ['默认先只读']
      }).summary
    ).toContain('上下文');

    expect(
      ManagerPlanSchema.parse({
        id: 'plan-1',
        goal: 'audit runtime contract host',
        summary: '先锁住 schema，再迁移宿主。',
        steps: ['定义 schema', '更新兼容导出'],
        subTasks: [
          {
            id: 'subtask-1',
            title: '定义 schema',
            description: '把 planning/orchestration 契约搬到 core',
            assignedTo: 'manager',
            status: 'pending'
          }
        ],
        createdAt: '2026-04-16T00:00:00.000Z'
      }).goal
    ).toBe('audit runtime contract host');

    expect(
      AgentMessageRecordSchema.parse({
        id: 'msg-1',
        taskId: 'task-1',
        from: 'manager',
        to: 'research',
        type: 'dispatch',
        content: '请先确认 tasking 契约边界。',
        createdAt: '2026-04-16T00:00:00.000Z'
      }).to
    ).toBe('research');

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
      }).dispatchChain?.[1]
    ).toBe('result_aggregator');

    expect(
      PartialAggregationRecordSchema.parse({
        kind: 'preview',
        summary: '生成预览',
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
      }).status
    ).toBe('open');

    expect(
      ComplexTaskPlanRecordSchema.parse({
        node: 'complex_task_plan',
        status: 'pending',
        summary: '等待拆解',
        subGoals: ['收紧 contract'],
        dependencies: [],
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).node
    ).toBe('complex_task_plan');

    expect(
      BlackboardStateRecordSchema.parse({
        node: 'blackboard_state',
        taskId: 'task-1',
        visibleScopes: ['supervisor', 'strategy'],
        refs: { traceCount: 0, evidenceCount: 0 },
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).refs.evidenceCount
    ).toBe(0);

    expect(
      MicroLoopStateRecordSchema.parse({
        state: 'idle',
        attempt: 0,
        maxAttempts: 2,
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).state
    ).toBe('idle');

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
      }).totalSteps
    ).toBe(2);

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
      }).ministry
    ).toBe('libu-governance');

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
      }).trustAdjustment
    ).toBe('promote');
  });

  it('keeps queue and llm usage contracts stable in core', () => {
    const queue: QueueStateRecord = {
      mode: 'foreground',
      backgroundRun: false,
      status: 'running',
      enqueuedAt: '2026-04-15T00:00:00.000Z',
      lastTransitionAt: '2026-04-15T00:00:00.000Z',
      attempt: 1
    };
    const usage: LlmUsageRecord = {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      estimated: false,
      measuredCallCount: 1,
      estimatedCallCount: 0,
      models: [
        {
          model: 'glm-4.5',
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          pricingSource: 'provider',
          callCount: 1
        }
      ],
      updatedAt: '2026-04-15T00:00:00.000Z'
    };

    expect(queue.status).toBe('running');
    expect(usage.models[0]?.model).toBe('glm-4.5');
  });

  it('parses queue and llm usage contracts from schema-first core definitions', () => {
    expect(
      QueueStateRecordSchema.parse({
        mode: 'foreground',
        backgroundRun: false,
        status: 'running',
        enqueuedAt: '2026-04-15T00:00:00.000Z',
        lastTransitionAt: '2026-04-15T00:00:00.000Z',
        attempt: 1
      }).status
    ).toBe('running');

    expect(
      LlmUsageRecordSchema.parse({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        estimated: false,
        measuredCallCount: 1,
        estimatedCallCount: 0,
        models: [
          {
            model: 'glm-4.5',
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
            callCount: 1
          }
        ],
        updatedAt: '2026-04-15T00:00:00.000Z'
      }).totalTokens
    ).toBe(30);
  });

  it('keeps knowledge evidence and execution trace contracts stable in core', () => {
    const trace: ExecutionTrace = {
      node: 'runtime.governance',
      at: '2026-04-15T00:00:00.000Z',
      summary: 'connector policy evaluated',
      status: 'success',
      role: 'planner'
    };
    const evidence: EvidenceRecord = {
      id: 'evidence-1',
      taskId: 'task-1',
      sourceType: 'document',
      sourceUrl: 'https://example.com/runtime',
      trustClass: 'internal',
      sourceStore: 'cangjing',
      summary: 'runtime governance document',
      createdAt: '2026-04-15T00:00:00.000Z'
    };

    expect(trace.role).toBe('planner');
    expect(isCitationEvidenceSource(evidence)).toBe(true);
  });

  it('keeps memory and rule records stable in core', () => {
    const memory: MemoryRecord = {
      id: 'memory-1',
      type: 'fact',
      summary: 'Provider audit endpoint configured',
      content: 'Use provider audit adapter first.',
      tags: ['runtime', 'provider-audit'],
      createdAt: '2026-04-15T00:00:00.000Z',
      quarantined: false
    };
    const rule: RuleRecord = {
      id: 'rule-1',
      name: 'Prefer controlled audit',
      summary: 'Use configured provider audit before fallback estimation.',
      conditions: ['providerAudit.adapters.length > 0'],
      action: 'fetchProviderUsageAudit',
      createdAt: '2026-04-15T00:00:00.000Z'
    };

    expect(memory.tags).toContain('runtime');
    expect(rule.action).toBe('fetchProviderUsageAudit');
  });

  it('parses modern memory contracts while keeping legacy memory fields compatible', () => {
    const parsed = MemoryRecordSchema.parse({
      id: 'memory-modern-1',
      type: 'fact',
      memoryType: 'constraint',
      scopeType: 'workspace',
      summary: 'Workspace requires manual deploy approval',
      content: 'Never auto deploy without explicit approval.',
      tags: ['deploy', 'approval'],
      importance: 10,
      confidence: 0.95,
      sourceEvidenceIds: ['evidence-1'],
      relatedEntities: [{ entityType: 'workspace', entityId: 'workspace-1' }],
      usageMetrics: {
        retrievedCount: 2,
        injectedCount: 2,
        adoptedCount: 1,
        dismissedCount: 0,
        correctedCount: 0
      },
      version: 3,
      status: 'active',
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    const legacy = MemoryRecordSchema.parse({
      id: 'memory-legacy-1',
      type: 'fact',
      summary: 'legacy memory',
      content: 'still valid',
      tags: ['legacy'],
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    expect(parsed.scopeType).toBe('workspace');
    expect(parsed.relatedEntities[0]?.entityId).toBe('workspace-1');
    expect(legacy.type).toBe('fact');
    expect(legacy.memoryType).toBeUndefined();
  });

  it('parses profile, reflection, search, resolution, and event contracts in core', () => {
    expect(
      UserProfileRecordSchema.parse({
        id: 'profile-1',
        userId: 'user-1',
        communicationStyle: 'concise',
        doNotDo: ['auto-commit'],
        privacyFlags: ['sensitive-repo'],
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).scopeType
    ).toBe('user');

    expect(
      ReflectionRecordSchema.parse({
        id: 'reflection-1',
        taskId: 'task-1',
        kind: 'failurePattern',
        summary: 'Auto commit caused rollback',
        whatWorked: ['asked before editing'],
        whatFailed: ['committed too early'],
        nextAttemptAdvice: ['wait for human confirmation'],
        promotedMemoryIds: ['memory-1'],
        promotedRuleIds: ['rule-1'],
        createdAt: '2026-04-16T00:00:00.000Z'
      }).kind
    ).toBe('failurePattern');

    expect(
      ResolutionCandidateRecordSchema.parse({
        id: 'resolution-1',
        conflictKind: 'semantic_conflict',
        challengerId: 'memory-2',
        incumbentId: 'memory-1',
        suggestedAction: 'supersede_existing',
        confidence: 0.92,
        rationale: 'newer correction from user',
        requiresHumanReview: false,
        createdAt: '2026-04-16T00:00:00.000Z'
      }).suggestedAction
    ).toBe('supersede_existing');

    expect(
      MemoryEventRecordSchema.parse({
        id: 'event-1',
        memoryId: 'memory-1',
        version: 2,
        type: 'memory.updated',
        payload: { changed: ['content'] },
        createdAt: '2026-04-16T00:00:00.000Z'
      }).type
    ).toBe('memory.updated');

    expect(
      MemorySearchRequestSchema.parse({
        query: 'manual deploy',
        scopeContext: {
          actorRole: 'agent-chat-user',
          allowedScopeTypes: ['session', 'user', 'workspace']
        },
        entityContext: [{ entityType: 'workspace', entityId: 'workspace-1' }],
        memoryTypes: ['constraint'],
        includeRules: true,
        includeReflections: true,
        limit: 5
      }).query
    ).toBe('manual deploy');

    expect(
      MemorySearchResultSchema.parse({
        coreMemories: [],
        archivalMemories: [],
        rules: [],
        reflections: [],
        reasons: []
      }).coreMemories
    ).toEqual([]);
  });
});
