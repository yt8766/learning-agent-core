import { describe, expect, it } from 'vitest';
import * as KnowledgeContracts from '@agent/knowledge';
import * as MemoryContracts from '@agent/memory';
import * as RuntimeContracts from '@agent/runtime';

import type {
  ActionIntent,
  ApprovalScope,
  ApprovalDecisionRecord,
  ApprovalScopePolicyRecord,
  CapabilityAugmentationRecord,
  CapabilityAttachmentRecord,
  CapabilityGovernanceProfileRecord,
  ConnectorCapabilityUsageRecord,
  ConnectorHealthRecord,
  ConnectorKnowledgeIngestionSummary,
  CompanyAgentRecord,
  DeliveryCitationRecord,
  DeliverySourceSummaryRecord,
  EvidenceRecord,
  EvaluationResult,
  ExecutionPlanMode,
  ExecutionTrace,
  HealthCheckResult,
  InstalledSkillRecord,
  LearningSourceType,
  LlmUsageRecord,
  QueueStateRecord,
  MemoryRecord,
  McpCapability,
  PlatformApprovalRecord,
  PlanDraftRecord,
  PlanQuestionRecord,
  RequestedExecutionHints,
  ManagerPlan,
  AgentMessageRecord,
  AgentExecutionState,
  ChatEventRecord,
  ChatCheckpointRecord,
  ChatMessageRecord,
  ChatRole,
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
  SkillCard,
  SkillInstallReceipt,
  SkillManifestRecord,
  SkillSourceRecord,
  ToolExecutionResult,
  TrustClass,
  WorkflowVersionRecord,
  GovernanceProfileRecord,
  SharedPlatformConsoleRecord
} from '../src';
import {
  AgentExecutionStateSchema,
  AgentMessageRecordSchema,
  ApprovalRequestChatMessageCardSchema,
  ApprovalScopeValues,
  ApprovalRecordSchema,
  CapabilityCatalogChatMessageCardSchema,
  ChatCheckpointAgentStatesSchema,
  ChatCheckpointCursorFieldsSchema,
  ChatCheckpointMetadataSchema,
  ChatCheckpointPendingApprovalsSchema,
  ChatCheckpointRecordSchema,
  ChatCheckpointSharedStringRefsSchema,
  ChatCheckpointSpecialistStateSchema,
  ChatMessageFeedbackRecordSchema,
  ChatMessageFeedbackRequestSchema,
  ChatSessionTitleSourceSchema,
  ChatApprovalRequestPreviewItemSchema,
  ChatCapabilityCatalogGroupSchema,
  ChatCapabilityCatalogItemSchema,
  ChatEventRecordSchema,
  ChatMessageCardSchema,
  ChatMessageRecordSchema,
  ChatPlanQuestionCardStatusSchema,
  ChatSkillDraftContractSchema,
  ChatSessionRecordSchema,
  ChatThinkStateSchema,
  ChatThoughtChainItemSchema,
  ChatRoleValues,
  BlackboardStateRecordSchema,
  BlackboardRefsSchema,
  CapabilityAugmentationRecordSchema,
  BudgetGateStateRecordSchema,
  CapabilityAttachmentRecordSchema,
  CapabilityGovernanceProfileRecordSchema,
  CompanyAgentRecordSchema,
  ComplexTaskPlanRecordSchema,
  ComplexTaskPlanDependencySchema,
  ContextSliceRecordSchema,
  ContextSliceRecentTurnSchema,
  ContextFilterRecordSchema,
  ConnectorCapabilityUsageRecordSchema,
  ConnectorHealthRecordSchema,
  ConnectorKnowledgeIngestionSummarySchema,
  CriticStateRecordSchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  CreateTaskDtoSchema,
  CounselorSelectorSchema,
  DispatchChainNodeSchema,
  DispatchInstructionSchema,
  EntryDecisionRecordSchema,
  EvaluationReportRecordSchema,
  EvaluationResultSchema,
  FinalReviewRecordSchema,
  GuardrailStateRecordSchema,
  ImperialDirectIntentSchema,
  InternalSubAgentResultSchema,
  ExecutionPlanRecordSchema,
  ExecutionPlanModeValues,
  GovernanceReportRecordSchema,
  GovernanceProfileRecordSchema,
  GovernanceDimensionSchema,
  GovernanceInterruptLoadSchema,
  GovernanceReviewOutcomeSchema,
  GovernanceScoreRecordSchema,
  HealthCheckResultSchema,
  InstalledSkillRecordSchema,
  KnowledgeIndexStateRecordSchema,
  KnowledgeIngestionStateRecordSchema,
  LearningSourceTypeValues,
  LlmUsageRecordSchema,
  ManagerPlanSchema,
  MemoryEventRecordSchema,
  PartialAggregationRecordSchema,
  PartialAggregationOutputKindSchema,
  PartialAggregationPolicySchema,
  PlanDraftRecordSchema,
  PlanDraftMicroBudgetSchema,
  PlanDraftQuestionSetSchema,
  PlanQuestionChatMessageCardSchema,
  PlanQuestionRecordSchema,
  PlannerStrategyRecordSchema,
  RequestedExecutionHintsSchema,
  SkillInstallReceiptSchema,
  SkillManifestRecordSchema,
  ReviewDecisionValues,
  QueueStateRecordSchema,
  RiskLevelValues,
  WorkflowVersionRecordSchema,
  MicroLoopStateRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema,
  SkillSearchStateRecordSchema,
  TaskBackgroundLearningStateSchema,
  TaskBackgroundLearningModeSchema,
  TaskBackgroundLearningStatusSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphMicroLoopStateSchema,
  TaskCheckpointGraphMicroLoopStateValueSchema,
  TaskCheckpointGraphMicroLoopStatusSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointGraphRevisionStateSchema,
  TaskCheckpointStreamStatusSchema,
  TaskModeGateStateSchema,
  TaskRecordAgentOutputsSchema,
  TaskRecordExecutionStateSchema,
  TaskRecordPlanningStateSchema,
  ChannelIdentitySchema,
  CheckpointRefSchema,
  SkillCardSchema,
  SkillSourceRecordSchema,
  SkillDraftCreatedChatMessageCardSchema,
  InstallSkillDtoSchema,
  RemoteSkillSearchDtoSchema,
  RemoteSkillSearchResultRecordSchema,
  InstallRemoteSkillDtoSchema,
  ResolveSkillInstallDtoSchema,
  ConfigureConnectorDtoSchema,
  ConfiguredConnectorRecordSchema,
  ConnectorDiscoveryHistoryRecordSchema,
  ThoughtGraphRecordSchema,
  ThoughtGraphEdgeSchema,
  ThoughtGraphNodeSchema,
  TaskRecordSchema,
  SandboxStateRecordSchema,
  TrustClassValues,
  TrustClassSchema,
  RunCancelledChatMessageCardSchema,
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

  it('parses chat message feedback contracts', () => {
    const request = ChatMessageFeedbackRequestSchema.parse({
      sessionId: 'session-1',
      rating: 'unhelpful',
      reasonCode: 'too_shallow',
      comment: '需要对比表'
    });

    expect(request.rating).toBe('unhelpful');
    expect(
      ChatMessageFeedbackRecordSchema.parse({
        messageId: 'message-1',
        sessionId: 'session-1',
        rating: 'unhelpful',
        reasonCode: 'too_shallow',
        comment: '需要对比表',
        updatedAt: '2026-05-03T00:00:00.000Z'
      }).messageId
    ).toBe('message-1');

    expect(() =>
      ChatMessageFeedbackRequestSchema.parse({
        sessionId: 'session-1',
        rating: 'unhelpful'
      })
    ).toThrow();
    expect(() =>
      ChatMessageFeedbackRequestSchema.parse({
        sessionId: 'session-1',
        rating: 'helpful',
        reasonCode: 'too_shallow'
      })
    ).toThrow();
    expect(() =>
      ChatMessageFeedbackRequestSchema.parse({
        sessionId: 'session-1',
        rating: 'none',
        reasonCode: 'other'
      })
    ).toThrow();
    expect(() =>
      ChatMessageFeedbackRecordSchema.parse({
        messageId: 'message-1',
        sessionId: 'session-1',
        rating: 'unhelpful',
        updatedAt: '2026-05-03T00:00:00.000Z'
      })
    ).toThrow();
    expect(() =>
      ChatMessageFeedbackRecordSchema.parse({
        messageId: 'message-1',
        sessionId: 'session-1',
        rating: 'helpful',
        reasonCode: 'too_shallow',
        updatedAt: '2026-05-03T00:00:00.000Z'
      })
    ).toThrow();

    expect(ChatMessageFeedbackRequestSchema.parse({ sessionId: 'session-1', rating: 'helpful' }).rating).toBe(
      'helpful'
    );
    expect(ChatMessageFeedbackRequestSchema.parse({ sessionId: 'session-1', rating: 'none' }).rating).toBe('none');
  });

  it('preserves valid assistant feedback on chat message records', () => {
    const parsed = ChatMessageRecordSchema.parse({
      id: 'message-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '可以这样做',
      createdAt: '2026-05-03T00:00:00.000Z',
      feedback: {
        messageId: 'message-1',
        sessionId: 'session-1',
        rating: 'unhelpful',
        reasonCode: 'missed_point',
        comment: '漏了约束',
        updatedAt: '2026-05-03T01:00:00.000Z'
      }
    });

    expect(parsed.feedback).toEqual({
      messageId: 'message-1',
      sessionId: 'session-1',
      rating: 'unhelpful',
      reasonCode: 'missed_point',
      comment: '漏了约束',
      updatedAt: '2026-05-03T01:00:00.000Z'
    });
  });

  it('parses message feedback learning candidate chat events', () => {
    const parsed = ChatEventRecordSchema.parse({
      id: 'event-1',
      sessionId: 'session-1',
      type: 'message_feedback_learning_candidate',
      at: '2026-05-03T00:00:00.000Z',
      payload: {
        messageId: 'message-1',
        rating: 'unhelpful',
        reasonCode: 'too_shallow',
        candidateText: '基础技术概念题回答时先给核心结论。',
        source: 'message_feedback'
      }
    });

    expect(parsed.type).toBe('message_feedback_learning_candidate');
  });

  it('rejects invalid embedded feedback on chat message records', () => {
    const baseMessage = {
      id: 'message-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '可以这样做',
      createdAt: '2026-05-03T00:00:00.000Z'
    };

    expect(() =>
      ChatMessageRecordSchema.parse({
        ...baseMessage,
        feedback: {
          messageId: 'message-1',
          sessionId: 'session-1',
          rating: 'helpful',
          reasonCode: 'missed_point',
          updatedAt: '2026-05-03T01:00:00.000Z'
        }
      })
    ).toThrow();
    expect(() =>
      ChatMessageRecordSchema.parse({
        ...baseMessage,
        feedback: {
          messageId: 'message-1',
          sessionId: 'session-1',
          rating: 'unhelpful',
          updatedAt: '2026-05-03T01:00:00.000Z'
        }
      })
    ).toThrow();
  });

  it('keeps evaluation result as a schema-first core contract', () => {
    const evaluation: EvaluationResult = {
      success: true,
      quality: 'high',
      shouldRetry: false,
      shouldWriteMemory: false,
      shouldCreateRule: false,
      shouldExtractSkill: true,
      notes: ['review contract moved to core']
    };

    expect(EvaluationResultSchema.parse(evaluation).shouldExtractSkill).toBe(true);
  });

  it('parses tool governance contracts from core-hosted schemas', () => {
    expect(RuntimeContracts.ToolCapabilityTypeSchema.parse('local-tool')).toBe('local-tool');
    expect(RuntimeContracts.ToolPermissionScopeSchema.parse('readonly')).toBe('readonly');
    expect(RuntimeContracts.PreflightGovernanceDecisionSchema.parse('allow')).toBe('allow');
    expect(
      RuntimeContracts.ToolFamilyRecordSchema.parse({
        id: 'filesystem',
        displayName: 'Filesystem',
        description: 'workspace file operations',
        capabilityType: 'local-tool',
        ownerType: 'shared'
      }).id
    ).toBe('filesystem');
    expect(
      RuntimeContracts.ToolDefinitionSchema.parse({
        name: 'filesystem.read',
        description: 'read project files',
        family: 'filesystem',
        category: 'knowledge',
        riskLevel: 'low',
        requiresApproval: false,
        timeoutMs: 5000,
        sandboxProfile: 'readonly',
        capabilityType: 'local-tool',
        isReadOnly: true,
        isConcurrencySafe: true,
        isDestructive: false,
        supportsStreamingDispatch: false,
        permissionScope: 'readonly',
        inputSchema: {}
      }).category
    ).toBe('knowledge');
    expect(
      RuntimeContracts.ToolExecutionRequestSchema.parse({
        taskId: 'task-1',
        toolName: 'filesystem.read',
        intent: 'read_file',
        input: { path: 'README.md' },
        requestedBy: 'agent'
      }).toolName
    ).toBe('filesystem.read');
    expect(
      RuntimeContracts.PermissionCheckResultSchema.parse({
        decision: 'allow',
        reason: 'policy matched',
        reasonCode: 'static_policy_allow'
      }).decision
    ).toBe('allow');
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
      matchKey: RuntimeContracts.buildApprovalScopeMatchKey({
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
      RuntimeContracts.matchesApprovalScopePolicy(policy, {
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
      RuntimeContracts.ConnectorHealthRecordSchema.parse({
        connectorId: 'github',
        healthState: 'healthy',
        checkedAt: '2026-04-15T00:00:00.000Z'
      }).connectorId
    ).toBe('github');

    expect(
      RuntimeContracts.ApprovalPolicyRecordSchema.parse({
        id: 'policy-1',
        scope: 'connector',
        targetId: 'github',
        mode: 'require-approval',
        reason: 'connector writes'
      }).scope
    ).toBe('connector');

    expect(
      RuntimeContracts.ApprovalScopePolicyRecordSchema.parse({
        id: 'scope-1',
        scope: 'session',
        status: 'active',
        matchKey: RuntimeContracts.buildApprovalScopeMatchKey({
          intent: 'edit file',
          toolName: 'filesystem.write'
        }),
        createdAt: '2026-04-15T00:00:00.000Z',
        updatedAt: '2026-04-15T00:00:00.000Z'
      }).status
    ).toBe('active');

    expect(
      RuntimeContracts.McpCapabilitySchema.parse({
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
        retryCount: 1,
        microLoopState: {
          status: 'active',
          state: 'retrying',
          attempt: 1
        },
        revisionState: 'revising'
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

    expect(TaskBackgroundLearningStatusSchema.parse('running')).toBe('running');
    expect(TaskBackgroundLearningModeSchema.parse('dream-task')).toBe('dream-task');
    expect(TaskCheckpointGraphMicroLoopStatusSchema.parse('completed')).toBe('completed');
    expect(TaskCheckpointGraphMicroLoopStateValueSchema.parse('exhausted')).toBe('exhausted');
    expect(TaskCheckpointGraphRevisionStateSchema.parse('blocked')).toBe('blocked');
    expect(
      TaskCheckpointGraphMicroLoopStateSchema.parse({
        status: 'active',
        state: 'retrying',
        attempt: 2
      }).attempt
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

  it('parses named chat card sub-schemas from tasking chat schema host', () => {
    expect(
      ChatApprovalRequestPreviewItemSchema.parse({
        label: 'Path',
        value: 'packages/core/src/tasking/schemas/chat.ts'
      }).label
    ).toBe('Path');
    expect(
      ApprovalRequestChatMessageCardSchema.parse({
        type: 'approval_request',
        intent: 'write_file',
        preview: [{ label: 'Path', value: 'README.md' }]
      }).type
    ).toBe('approval_request');
    expect(ChatPlanQuestionCardStatusSchema.parse('answered')).toBe('answered');
    expect(
      PlanQuestionChatMessageCardSchema.parse({
        type: 'plan_question',
        title: 'Confirm direction',
        questions: [
          {
            id: 'q-1',
            question: 'Which path should we take?',
            questionType: 'direction',
            options: [{ id: 'a', label: 'A', description: 'Use path A' }]
          }
        ]
      }).type
    ).toBe('plan_question');
    expect(
      RunCancelledChatMessageCardSchema.parse({
        type: 'run_cancelled',
        reason: 'User requested stop'
      }).type
    ).toBe('run_cancelled');
    expect(
      ChatCapabilityCatalogItemSchema.parse({
        id: 'cap-1',
        displayName: 'Filesystem Write'
      }).displayName
    ).toBe('Filesystem Write');
    expect(
      ChatCapabilityCatalogGroupSchema.parse({
        key: 'tools',
        label: 'Tools',
        kind: 'tool',
        items: [{ id: 'cap-1', displayName: 'Filesystem Write' }]
      }).kind
    ).toBe('tool');
    expect(
      CapabilityCatalogChatMessageCardSchema.parse({
        type: 'capability_catalog',
        title: 'Available capabilities',
        groups: [{ key: 'tools', label: 'Tools', kind: 'tool', items: [] }]
      }).type
    ).toBe('capability_catalog');
    expect(
      ChatSkillDraftContractSchema.parse({
        requiredTools: ['filesystem.read'],
        optionalTools: [],
        approvalSensitiveTools: [],
        preferredConnectors: [],
        requiredConnectors: []
      }).requiredTools
    ).toEqual(['filesystem.read']);
    expect(
      SkillDraftCreatedChatMessageCardSchema.parse({
        type: 'skill_draft_created',
        skillId: 'skill-1',
        displayName: 'Repo Auditor',
        description: 'Audit the repo',
        ownerType: 'shared',
        scope: 'workspace',
        status: 'draft',
        enabled: true,
        nextActions: ['review']
      }).type
    ).toBe('skill_draft_created');
    expect(
      ChatMessageCardSchema.parse({
        type: 'capability_catalog',
        title: 'Available capabilities',
        groups: [{ key: 'tools', label: 'Tools', kind: 'tool', items: [] }]
      }).type
    ).toBe('capability_catalog');
  });

  it('parses chat session and channel identity contracts from schema-first core definitions', () => {
    const session: ChatSessionRecord = {
      id: 'session-1',
      title: 'Runtime contract audit',
      titleSource: 'manual',
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
    expect(ChatSessionTitleSourceSchema.parse(session.titleSource)).toBe('manual');
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

    expect(RuntimeContracts.ApprovalRecordSchema.parse(approval).decision).toBe('pending');
    expect(AgentExecutionStateSchema.parse(agentState).role).toBe('research');
    expect(
      ChatCheckpointPendingApprovalsSchema.parse({
        pendingApprovals: [approval]
      }).pendingApprovals[0]?.taskId
    ).toBe('task-1');
    expect(
      ChatCheckpointAgentStatesSchema.parse({
        agentStates: [agentState]
      }).agentStates[0]?.agentId
    ).toBe('agent-1');
    expect(
      ChatCheckpointMetadataSchema.parse({
        checkpointId: 'checkpoint-1',
        sessionId: 'session-1',
        taskId: 'task-1',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z'
      }).checkpointId
    ).toBe('checkpoint-1');
    expect(
      ChatCheckpointCursorFieldsSchema.parse({
        traceCursor: 1,
        messageCursor: 1,
        approvalCursor: 1,
        learningCursor: 0
      }).traceCursor
    ).toBe(1);
    expect(
      ChatCheckpointSharedStringRefsSchema.parse({
        reusedMemories: ['memory-1'],
        connectorRefs: ['connector-1']
      }).connectorRefs?.[0]
    ).toBe('connector-1');
    expect(
      ChatCheckpointSpecialistStateSchema.parse({
        supportingSpecialists: [
          {
            id: 'risk-compliance',
            displayName: 'Risk',
            domain: 'risk-compliance'
          }
        ]
      }).supportingSpecialists?.[0]?.domain
    ).toBe('risk-compliance');
    expect(
      TaskRecordExecutionStateSchema.parse({
        currentStep: 'delivery',
        retryCount: 1,
        microLoopState: {
          state: 'retrying',
          attempt: 1,
          maxAttempts: 2,
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      }).currentStep
    ).toBe('delivery');
    expect(
      TaskRecordPlanningStateSchema.parse({
        executionMode: 'plan',
        planDraft: {
          summary: '先读上下文',
          autoResolved: [],
          openQuestions: [],
          assumptions: []
        }
      }).executionMode
    ).toBe('plan');
    expect(
      TaskRecordAgentOutputsSchema.parse({
        agentStates: [agentState],
        messages: []
      }).agentStates[0]?.agentId
    ).toBe('agent-1');
    expect(ChatCheckpointRecordSchema.parse(checkpoint).pendingApprovals[0]?.taskId).toBe('task-1');
    expect(TaskRecordSchema.parse(task).goal).toContain('runtime');
  });

  it('parses formerly-any checkpoint and task runtime support fields from explicit schemas', () => {
    expect(
      SkillSearchStateRecordSchema.parse({
        capabilityGapDetected: true,
        status: 'suggested',
        suggestions: [
          {
            id: 'skill-1',
            kind: 'remote-skill',
            displayName: 'Runtime Audit Skill',
            summary: '补齐 runtime 审计能力',
            score: 0.91,
            availability: 'installable-remote',
            reason: '检测到 runtime 能力缺口',
            requiredCapabilities: ['filesystem.read'],
            triggerReason: 'capability_gap_detected'
          }
        ],
        safetyNotes: ['需要先评估来源可信度'],
        query: 'runtime audit'
      }).suggestions[0]?.kind
    ).toBe('remote-skill');

    expect(
      KnowledgeContracts.BudgetStateSchema.parse({
        stepBudget: 8,
        stepsConsumed: 3,
        retryBudget: 1,
        retriesConsumed: 0,
        sourceBudget: 6,
        sourcesConsumed: 2,
        budgetInterruptState: {
          status: 'soft-threshold-triggered',
          interactionKind: 'approval'
        }
      }).budgetInterruptState?.status
    ).toBe('soft-threshold-triggered');

    expect(
      KnowledgeContracts.LearningEvaluationRecordSchema.parse({
        score: 92,
        confidence: 'high',
        notes: ['evidence stable'],
        recommendedCandidateIds: ['candidate-1'],
        autoConfirmCandidateIds: ['candidate-1'],
        sourceSummary: {
          externalSourceCount: 1,
          internalSourceCount: 2,
          reusedMemoryCount: 1,
          reusedRuleCount: 0,
          reusedSkillCount: 1
        }
      }).confidence
    ).toBe('high');

    expect(
      RuntimeContracts.ToolAttachmentRecordSchema.parse({
        toolName: 'filesystem.read',
        family: 'filesystem',
        ownerType: 'runtime-derived',
        attachedAt: '2026-04-17T00:00:00.000Z',
        attachedBy: 'runtime',
        preferred: true
      }).ownerType
    ).toBe('runtime-derived');

    expect(
      RuntimeContracts.ToolAttachmentRecordSchema.parse({
        toolName: 'connector.github',
        family: 'connector',
        ownerType: 'user-attached',
        ownerId: 'workspace-github',
        attachedAt: '2026-04-17T00:00:00.000Z',
        attachedBy: 'user',
        preferred: true
      }).ownerType
    ).toBe('user-attached');

    expect(
      RuntimeContracts.ToolUsageSummaryRecordSchema.parse({
        toolName: 'filesystem.read',
        family: 'filesystem',
        capabilityType: 'local-tool',
        status: 'completed',
        route: 'local',
        usedAt: '2026-04-17T00:00:00.000Z'
      }).status
    ).toBe('completed');

    expect(
      ContextFilterRecordSchema.parse({
        node: 'context_filter',
        status: 'completed',
        filteredContextSlice: {
          summary: 'trimmed context',
          historyTraceCount: 2,
          evidenceCount: 1,
          specialistCount: 1,
          ministryCount: 1
        },
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z'
      }).node
    ).toBe('context_filter');

    expect(
      GuardrailStateRecordSchema.parse({
        stage: 'pre',
        verdict: 'pass_through',
        summary: 'safe to continue',
        updatedAt: '2026-04-17T00:00:00.000Z'
      }).verdict
    ).toBe('pass_through');

    expect(
      CriticStateRecordSchema.parse({
        node: 'critic',
        decision: 'rewrite_required',
        summary: 'tighten evidence language',
        updatedAt: '2026-04-17T00:00:00.000Z',
        createdAt: '2026-04-17T00:00:00.000Z'
      }).decision
    ).toBe('rewrite_required');

    expect(
      SandboxStateRecordSchema.parse({
        node: 'sandbox',
        stage: 'gongbu',
        status: 'running',
        attempt: 1,
        maxAttempts: 2,
        updatedAt: '2026-04-17T00:00:00.000Z'
      }).stage
    ).toBe('gongbu');

    expect(
      FinalReviewRecordSchema.parse({
        node: 'final_review',
        ministry: 'xingbu',
        decision: 'pass',
        summary: 'ready to deliver',
        interruptRequired: false,
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z'
      }).decision
    ).toBe('pass');

    expect(
      KnowledgeIngestionStateRecordSchema.parse({
        node: 'knowledge_ingestion',
        store: 'wenyuan',
        status: 'processing',
        updatedAt: '2026-04-17T00:00:00.000Z'
      }).store
    ).toBe('wenyuan');

    expect(
      KnowledgeIndexStateRecordSchema.parse({
        node: 'knowledge_index',
        store: 'cangjing',
        indexStatus: 'building',
        updatedAt: '2026-04-17T00:00:00.000Z'
      }).indexStatus
    ).toBe('building');

    expect(
      EvaluationReportRecordSchema.parse({
        id: 'report-1',
        ministry: 'libu-governance',
        score: 0.91,
        summary: 'governance stable',
        rlaifNotes: ['strong evidence'],
        derivedFromTaskId: 'task-1',
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z'
      }).score
    ).toBe(0.91);

    expect(
      InternalSubAgentResultSchema.parse({
        agentId: 'agent-1',
        status: 'needs_user_input',
        interactionKind: 'plan-question',
        questions: [
          {
            id: 'q-1',
            question: '继续收紧哪一层？',
            questionType: 'direction',
            options: [{ id: 'o-1', label: 'tasking', description: '继续 tasking facade 收口' }]
          }
        ],
        createdAt: '2026-04-17T00:00:00.000Z'
      }).status
    ).toBe('needs_user_input');
  });

  it('parses skills-search dto and connector contracts from schema-first core definitions', () => {
    expect(
      InstallSkillDtoSchema.parse({
        manifestId: 'manifest-1',
        actor: 'runtime-center'
      }).manifestId
    ).toBe('manifest-1');

    expect(
      RemoteSkillSearchDtoSchema.parse({
        query: 'runtime audit',
        triggerReason: 'capability_gap_detected',
        limit: 5
      }).query
    ).toBe('runtime audit');

    expect(
      RemoteSkillSearchResultRecordSchema.parse({
        query: 'runtime audit',
        discoverySource: 'market-index',
        triggerReason: 'capability_gap_detected',
        executedAt: '2026-04-17T00:00:00.000Z',
        results: []
      }).discoverySource
    ).toBe('market-index');

    expect(
      InstallRemoteSkillDtoSchema.parse({
        repo: 'org/runtime-audit-skill',
        triggerReason: 'user_requested'
      }).repo
    ).toBe('org/runtime-audit-skill');

    expect(
      ResolveSkillInstallDtoSchema.parse({
        actor: 'reviewer',
        reason: 'safe'
      }).actor
    ).toBe('reviewer');

    expect(
      ConfigureConnectorDtoSchema.parse({
        templateId: 'github-mcp-template',
        transport: 'stdio',
        displayName: 'GitHub MCP'
      }).templateId
    ).toBe('github-mcp-template');

    expect(
      ConfiguredConnectorRecordSchema.parse({
        connectorId: 'github-mcp',
        configuredAt: '2026-04-17T00:00:00.000Z',
        templateId: 'github-mcp-template',
        transport: 'stdio'
      }).connectorId
    ).toBe('github-mcp');

    expect(
      ConnectorDiscoveryHistoryRecordSchema.parse({
        connectorId: 'github-mcp',
        discoveredAt: '2026-04-17T00:00:00.000Z',
        discoveryMode: 'registered',
        sessionState: 'connected',
        discoveredCapabilities: ['filesystem.read']
      }).sessionState
    ).toBe('connected');
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

  it('parses capability augmentation contracts across dto and checkpoint boundaries', () => {
    const augmentation: CapabilityAugmentationRecord = CapabilityAugmentationRecordSchema.parse({
      id: 'augment-1',
      kind: 'skill',
      status: 'ready',
      requestedBy: 'workflow',
      targetKind: 'skill',
      target: 'runtime-audit-skill',
      reason: 'workflow requires structured runtime audit support',
      owner: {
        ownerType: 'shared',
        capabilityType: 'skill',
        scope: 'task',
        trigger: 'workflow_required'
      },
      summary: 'attach runtime audit skill before execution',
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z'
    });

    const dto = CreateTaskDtoSchema.parse({
      goal: 'audit runtime task bootstrap',
      lineage: {
        parentTaskId: 'task-origin',
        launchReason: 'replay',
        replaySourceLabel: 'trace · gongbu-code',
        replayScoped: true,
        baselineTaskId: 'task-origin'
      },
      capabilityAugmentations: [augmentation]
    });

    const checkpoint = ChatCheckpointRecordSchema.parse({
      checkpointId: 'checkpoint-1',
      sessionId: 'session-1',
      taskId: 'task-1',
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      traceCursor: 1,
      messageCursor: 1,
      approvalCursor: 0,
      learningCursor: 0,
      graphState: {
        status: 'running',
        currentStep: 'task-bootstrap'
      },
      pendingApprovals: [],
      agentStates: [],
      capabilityAugmentations: [augmentation]
    });

    expect(dto.capabilityAugmentations?.[0]?.target).toBe('runtime-audit-skill');
    expect(dto.lineage?.launchReason).toBe('replay');
    expect(checkpoint.capabilityAugmentations?.[0]?.owner.capabilityType).toBe('skill');
  });

  it('rejects malformed capability augmentation payloads at dto boundary', () => {
    expect(() =>
      CreateTaskDtoSchema.parse({
        goal: 'audit runtime task bootstrap',
        capabilityAugmentations: [
          {
            id: 'augment-1',
            kind: 'skill',
            status: 'ready',
            requestedBy: 'workflow',
            reason: 'missing owner should fail',
            createdAt: '2026-04-17T00:00:00.000Z',
            updatedAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      })
    ).toThrow();
  });

  it('parses task records with capability augmentation overlays', () => {
    const augmentation: CapabilityAugmentationRecord = {
      id: 'augment-2',
      kind: 'connector',
      status: 'suggested',
      requestedBy: 'supervisor',
      targetKind: 'connector',
      target: 'github-mcp-template',
      reason: 'need connector before execution',
      owner: {
        ownerType: 'runtime-derived',
        capabilityType: 'connector',
        scope: 'task',
        trigger: 'capability_gap_detected'
      },
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z'
    };

    const task = TaskRecordSchema.parse({
      id: 'task-augment-1',
      goal: 'prepare github-backed runtime audit',
      status: 'queued',
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      capabilityAugmentations: [augmentation],
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z'
    });

    expect(task.capabilityAugmentations?.[0]?.targetKind).toBe('connector');
    expect(task.capabilityAugmentations?.[0]?.owner.trigger).toBe('capability_gap_detected');
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
      CounselorSelectorSchema.parse({
        strategy: 'manual',
        candidateIds: ['c-1']
      }).strategy
    ).toBe('manual');
    expect(
      ImperialDirectIntentSchema.parse({
        enabled: true,
        trigger: 'known-capability',
        requestedCapability: 'filesystem.write'
      }).trigger
    ).toBe('known-capability');
    expect(DispatchChainNodeSchema.parse('dispatch_planner')).toBe('dispatch_planner');

    expect(
      ExecutionPlanRecordSchema.parse({
        mode: 'execute',
        dispatchChain: ['entry_router', 'result_aggregator']
      }).dispatchChain?.[1]
    ).toBe('result_aggregator');

    expect(
      PartialAggregationPolicySchema.parse({
        allowedOutputKinds: ['preview'],
        requiresInterruptApprovalForProgress: true
      }).allowedOutputKinds
    ).toEqual(['preview']);
    expect(PartialAggregationOutputKindSchema.parse('approved_lightweight_progress')).toBe(
      'approved_lightweight_progress'
    );

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
      PlanDraftQuestionSetSchema.parse({
        title: 'Clarify direction',
        summary: 'Need one answer before planning'
      }).title
    ).toBe('Clarify direction');
    expect(
      PlanDraftMicroBudgetSchema.parse({
        readOnlyToolLimit: 2,
        readOnlyToolsUsed: 1,
        budgetTriggered: false
      }).readOnlyToolLimit
    ).toBe(2);

    expect(
      DispatchInstructionSchema.parse({
        taskId: 'task-1',
        subTaskId: 'sub-1',
        from: 'manager',
        to: 'research',
        kind: 'strategy',
        objective: '先补证据',
        specialistDomain: 'technical-architecture',
        requiredCapabilities: ['specialist.technical-architecture'],
        agentId: 'official.coder',
        candidateAgentIds: ['official.coder', 'official.reviewer'],
        selectedAgentId: 'official.coder',
        selectionSource: 'specialist-lead'
      }).selectedAgentId
    ).toBe('official.coder');

    expect(
      DispatchInstructionSchema.parse({
        taskId: 'task-1',
        subTaskId: 'sub-1',
        from: 'manager',
        to: 'research',
        kind: 'strategy',
        objective: '先补证据',
        selectionSource: 'strategy-counselor'
      }).selectionSource
    ).toBe('strategy-counselor');

    expect(
      PlannerStrategyRecordSchema.parse({
        mode: 'rich-candidates',
        summary: '当前存在多个候选官方 Agent，规划将优先并行研究后再收敛。',
        leadDomain: 'technical-architecture',
        requiredCapabilities: ['specialist.technical-architecture'],
        preferredAgentId: 'official.coder',
        candidateAgentIds: ['official.coder', 'official.reviewer'],
        candidateCount: 2,
        gapDetected: false,
        updatedAt: '2026-04-19T00:00:00.000Z'
      }).mode
    ).toBe('rich-candidates');

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
      ContextSliceRecentTurnSchema.parse({
        role: 'assistant',
        content: '先确认 core host。'
      }).role
    ).toBe('assistant');

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
      ComplexTaskPlanDependencySchema.parse({
        from: 'planning',
        to: 'orchestration'
      }).to
    ).toBe('orchestration');

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
      BlackboardRefsSchema.parse({
        traceCount: 1,
        evidenceCount: 2,
        checkpointId: 'checkpoint-1'
      }).checkpointId
    ).toBe('checkpoint-1');

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

    expect(
      GovernanceDimensionSchema.parse({
        score: 0.9,
        summary: '执行质量稳定'
      }).score
    ).toBe(0.9);
    expect(
      GovernanceReviewOutcomeSchema.parse({
        decision: 'needs_human_approval',
        summary: '需要人工确认'
      }).decision
    ).toBe('needs_human_approval');
    expect(
      GovernanceInterruptLoadSchema.parse({
        interruptCount: 1,
        microLoopCount: 2,
        summary: '当前负载可控'
      }).microLoopCount
    ).toBe(2);
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
    expect(KnowledgeContracts.isCitationEvidenceSource(evidence)).toBe(true);
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
    const parsed = MemoryContracts.MemoryRecordSchema.parse({
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

    const legacy = MemoryContracts.MemoryRecordSchema.parse({
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
      MemoryContracts.UserProfileRecordSchema.parse({
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
      MemoryContracts.ReflectionRecordSchema.parse({
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
      MemoryContracts.ResolutionCandidateRecordSchema.parse({
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
      MemoryContracts.MemoryEventRecordSchema.parse({
        id: 'event-1',
        memoryId: 'memory-1',
        version: 2,
        type: 'memory.updated',
        payload: { changed: ['content'] },
        createdAt: '2026-04-16T00:00:00.000Z'
      }).type
    ).toBe('memory.updated');

    expect(
      MemoryContracts.MemorySearchRequestSchema.parse({
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
      MemoryContracts.MemorySearchResultSchema.parse({
        coreMemories: [],
        archivalMemories: [],
        rules: [],
        reflections: [],
        reasons: []
      }).coreMemories
    ).toEqual([]);
  });

  it('keeps intent and trust-class contracts stable in core', () => {
    const intent: ActionIntent = 'write_file';
    const trustClass: TrustClass = TrustClassSchema.parse('internal');

    expect(intent).toBe('write_file');
    expect(trustClass).toBe('internal');
  });

  it('exports primitive value collections from core without forcing downstream enum duplication', () => {
    const approvalScope: ApprovalScope = ApprovalScopeValues[1];
    const chatRole: ChatRole = ChatRoleValues[1];
    const executionPlanMode: ExecutionPlanMode = ExecutionPlanModeValues[2];
    const learningSourceType: LearningSourceType = LearningSourceTypeValues[0];

    expect(RiskLevelValues).toEqual(['low', 'medium', 'high', 'critical']);
    expect(ReviewDecisionValues).toEqual(['approved', 'retry', 'blocked']);
    expect(TrustClassValues).toContain('internal');
    expect(approvalScope).toBe('session');
    expect(chatRole).toBe('assistant');
    expect(executionPlanMode).toBe('imperial_direct');
    expect(learningSourceType).toBe('execution');
  });

  it('parses capability hints and attachments from core-hosted schemas', () => {
    const hints: RequestedExecutionHints = RequestedExecutionHintsSchema.parse({
      requestedSpecialist: 'technical-architecture',
      requestedCapability: 'filesystem.write',
      preferredMode: 'workflow'
    });
    const attachment: CapabilityAttachmentRecord = CapabilityAttachmentRecordSchema.parse({
      id: 'cap-1',
      displayName: 'Filesystem Write',
      kind: 'tool',
      owner: {
        ownerType: 'shared',
        capabilityType: 'tool',
        scope: 'workspace',
        trigger: 'workflow_required'
      },
      enabled: true,
      permission: 'write',
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    expect(hints.preferredMode).toBe('workflow');
    expect(attachment.owner.scope).toBe('workspace');
  });

  it('keeps skill, governance profile, and tool execution result contracts stable in core', () => {
    const skill: SkillCard = SkillCardSchema.parse({
      id: 'skill-1',
      name: 'Repo Auditor',
      description: 'Summarize repo structure and risks.',
      applicableGoals: ['audit repo'],
      requiredTools: ['filesystem.read'],
      steps: [{ title: 'Inspect', instruction: 'Read the repo', toolNames: ['filesystem.read'] }],
      constraints: ['read only'],
      successSignals: ['clear summary'],
      riskLevel: 'low',
      source: 'research',
      status: 'stable',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    });
    const capabilityProfile: CapabilityGovernanceProfileRecord = CapabilityGovernanceProfileRecordSchema.parse({
      capabilityId: 'cap-1',
      displayName: 'Filesystem Write',
      ownerType: 'shared',
      kind: 'tool',
      trustLevel: 'high',
      trustTrend: 'steady',
      reportCount: 4,
      promoteCount: 2,
      holdCount: 1,
      downgradeCount: 1,
      passCount: 3,
      reviseRequiredCount: 1,
      blockCount: 0,
      updatedAt: '2026-04-16T00:00:00.000Z'
    });
    const governanceProfile: GovernanceProfileRecord = GovernanceProfileRecordSchema.parse({
      entityId: 'gongbu-code',
      displayName: '工部',
      entityKind: 'ministry',
      trustLevel: 'high',
      trustTrend: 'up',
      reportCount: 8,
      promoteCount: 5,
      holdCount: 2,
      downgradeCount: 1,
      passCount: 7,
      reviseRequiredCount: 1,
      blockCount: 0,
      updatedAt: '2026-04-16T00:00:00.000Z'
    });
    const result: ToolExecutionResult = RuntimeContracts.ToolExecutionResultSchema.parse({
      ok: true,
      outputSummary: 'Applied the workspace change.',
      durationMs: 120
    });

    expect(skill.name).toBe('Repo Auditor');
    expect(capabilityProfile.kind).toBe('tool');
    expect(governanceProfile.entityKind).toBe('ministry');
    expect(result.ok).toBe(true);
  });

  it('keeps skill source and manifest contracts schema-first in core', () => {
    const source: SkillSourceRecord = SkillSourceRecordSchema.parse({
      id: 'workspace-skills',
      name: 'Workspace Skills',
      kind: 'internal',
      baseUrl: '/tmp/skills',
      discoveryMode: 'local-dir',
      trustClass: 'internal',
      priority: 'workspace/internal',
      enabled: true,
      profilePolicy: {
        enabledByProfile: true,
        recommendedForProfiles: ['platform', 'cli'],
        reason: 'workspace bootstrap skills'
      }
    });
    const manifest: SkillManifestRecord = SkillManifestRecordSchema.parse({
      id: 'repo_auditor',
      name: 'Repo Auditor',
      version: '1.0.0',
      description: 'Audit repository structure and risks.',
      publisher: 'workspace',
      sourceId: source.id,
      requiredCapabilities: ['documentation'],
      approvalPolicy: 'none',
      riskLevel: 'low',
      entry: '/tmp/skills/repo-auditor/SKILL.md',
      sourcePolicy: {
        mode: 'internal-only'
      },
      preferredMinistries: ['gongbu-code'],
      recommendedSpecialists: ['technical-architecture']
    });

    expect(source.profilePolicy?.recommendedForProfiles).toContain('cli');
    expect(manifest.preferredMinistries).toContain('gongbu-code');
  });

  it('keeps installed skill, install receipt, and company agent records schema-first in core', () => {
    const installed: InstalledSkillRecord = InstalledSkillRecordSchema.parse({
      skillId: 'repo_auditor',
      version: '1.0.0',
      sourceId: 'workspace-skills',
      installLocation: '/tmp/skills/repo-auditor/1.0.0',
      installedAt: '2026-04-17T00:00:00.000Z',
      status: 'installed',
      receiptId: 'receipt-1'
    });
    const receipt: SkillInstallReceipt = SkillInstallReceiptSchema.parse({
      id: 'receipt-1',
      skillId: 'repo_auditor',
      version: '1.0.0',
      sourceId: 'workspace-skills',
      status: 'installed',
      phase: 'installed',
      sourceDraftId: 'draft-repo-auditor'
    });
    const agent: CompanyAgentRecord = CompanyAgentRecordSchema.parse({
      id: 'gongbu-worker-1',
      ministry: 'gongbu-code',
      displayName: '工部执行官',
      defaultModel: 'gpt-5.4',
      supportedCapabilities: ['filesystem.read'],
      reviewPolicy: 'mandatory-xingbu'
    });

    expect(installed.status).toBe('installed');
    expect(receipt.sourceDraftId).toBe('draft-repo-auditor');
    expect(agent.ministry).toBe('gongbu-code');
  });

  it('keeps workflow version records schema-first in core', () => {
    const version: WorkflowVersionRecord = WorkflowVersionRecordSchema.parse({
      workflowId: 'review',
      version: '1.0.0',
      status: 'active',
      updatedAt: '2026-04-17T00:00:00.000Z',
      changelog: ['initial-registry-baseline']
    });

    expect(version.status).toBe('active');
  });
});
