import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  ChatMessageRecordSchema,
  TaskRecordSchema,
  DataReportJsonSchemaSchema,
  DataReportSandpackPayloadSchema,
  SkillCardSchema,
  SpecialistFindingSchema,
  ConnectorHealthRecordSchema,
  BudgetStateSchema,
  CreateTaskDtoSchema,
  ConnectorKnowledgeIngestionSummarySchema,
  WorkflowRouteContextSchema,
  DeliveryCitationRecordSchema,
  ExecutionTraceSchema,
  InstallSkillDtoSchema,
  PlatformApprovalRecordSchema,
  ArchitectureDescriptorSchema,
  RiskLevelSchema,
  buildApprovalScopeMatchKey,
  isCitationEvidenceSource
} from '../src';
import {
  type ArchitectureDescriptorRegistryEntry,
  type DataReportJsonGenerateInput,
  type DataReportSandpackGenerateInput,
  type CreateTaskDto,
  type ConnectorKnowledgeIngestionSummary,
  type WorkflowRouteContext,
  type DeliveryCitationRecord,
  type ExecutionTrace,
  type InstallSkillDto,
  type PlatformApprovalRecord,
  type ArchitectureDescriptor,
  type RiskLevel,
  type ChatMessageRecord,
  type TaskRecord,
  type DataReportJsonSchema,
  type DataReportSandpackPayload
} from '../src';
import { type SharedPlatformConsoleRecord, type RuntimeAgentGraphState, type AgentGraphHandlers } from '../src';
import { ChatMessageRecordSchema as DirectChatMessageRecordSchema } from '../src/tasking/schemas/chat';
import { TaskRecordSchema as DirectTaskRecordSchema } from '../src/tasking/schemas/task-record';
import { DataReportJsonSchemaSchema as DirectDataReportJsonSchemaSchema } from '../src/data-report/schemas/data-report-json-schema';
import { DataReportSandpackPayloadSchema as DirectDataReportSandpackPayloadSchema } from '../src/data-report/schemas/data-report';
import { SkillCardSchema as DirectSkillCardSchema } from '../src/skills/schemas/catalog';
import { SpecialistFindingSchema as DirectSpecialistFindingSchema } from '../src/review/schemas/specialist-finding.schema';
import { ConnectorHealthRecordSchema as DirectConnectorHealthRecordSchema } from '../src/governance/schemas/governance.schema';
import { BudgetStateSchema as DirectBudgetStateSchema } from '../src/knowledge/schemas/knowledge-runtime.schema';
import { CreateTaskDtoSchema as DirectCreateTaskDtoSchema } from '../src/channels/schemas/channels.schema';
import { ConnectorKnowledgeIngestionSummarySchema as DirectConnectorKnowledgeIngestionSummarySchema } from '../src/connectors/schemas/connectors.schema';
import { WorkflowRouteContextSchema as DirectWorkflowRouteContextSchema } from '../src/workflow-route/schemas/workflow-route.schema';
import { DeliveryCitationRecordSchema as DirectDeliveryCitationRecordSchema } from '../src/delivery/schemas/delivery.schema';
import { ExecutionTraceSchema as DirectExecutionTraceSchema } from '../src/execution-trace/schemas/execution-trace.schema';
import { InstallSkillDtoSchema as DirectInstallSkillDtoSchema } from '../src/skills-search/schemas/skills-search.schema';
import { PlatformApprovalRecordSchema as DirectPlatformApprovalRecordSchema } from '../src/platform-console/schemas/platform-console.schema';
import { ArchitectureDescriptorSchema as DirectArchitectureDescriptorSchema } from '../src/architecture/schemas/architecture-records.schema';
import { RiskLevelSchema as DirectRiskLevelSchema } from '../src/primitives/schemas/primitives.schema';
import { isCitationEvidenceSource as DirectIsCitationEvidenceSource } from '../src/knowledge/helpers/evidence';
import { type DataReportSandpackGenerateInput as DirectDataReportSandpackGenerateInput } from '../src/contracts/data-report/data-report';
import { type DataReportJsonGenerateInput as DirectDataReportJsonGenerateInput } from '../src/contracts/data-report/data-report-json';
import { type ArchitectureDescriptorRegistryEntry as DirectArchitectureDescriptorRegistryEntry } from '../src/contracts/architecture/architecture-records';
import { type SharedPlatformConsoleRecord as DirectSharedPlatformConsoleRecord } from '../src/contracts/platform-console/platform-console';
import {
  type RuntimeAgentGraphState as DirectRuntimeAgentGraphState,
  type AgentGraphHandlers as DirectAgentGraphHandlers
} from '../src/contracts/chat/chat-graph';
import { type RouterMinistryLike as DirectRouterMinistryLike } from '../src/contracts/ministries/router-ministry';
import { type ResearchMinistryLike as DirectResearchMinistryLike } from '../src/contracts/ministries/research-ministry';
import { type ReviewMinistryLike as DirectReviewMinistryLike } from '../src/contracts/ministries/review-ministry';
import { type DeliveryMinistryLike as DirectDeliveryMinistryLike } from '../src/contracts/ministries/delivery-ministry';
import { type CodeExecutionMinistryLike as DirectCodeExecutionMinistryLike } from '../src/contracts/ministries/code-execution-ministry';
import { type OpsExecutionMinistryLike as DirectOpsExecutionMinistryLike } from '../src/contracts/ministries/ops-execution-ministry';
import { type CreateTaskDto as DirectCreateTaskDto } from '../src/channels/types/channels.types';
import { type ConnectorKnowledgeIngestionSummary as DirectConnectorKnowledgeIngestionSummary } from '../src/connectors/types/connectors.types';
import { type WorkflowRouteContext as DirectWorkflowRouteContext } from '../src/workflow-route/types/workflow-route.types';
import { type DeliveryCitationRecord as DirectDeliveryCitationRecord } from '../src/delivery/types/delivery.types';
import { type ExecutionTrace as DirectExecutionTrace } from '../src/execution-trace/types/execution-trace.types';
import { type InstallSkillDto as DirectInstallSkillDto } from '../src/skills-search/types/skills-search.types';
import { type PlatformApprovalRecord as DirectPlatformApprovalRecord } from '../src/platform-console/types/platform-console.types';
import { type ArchitectureDescriptor as DirectArchitectureDescriptor } from '../src/architecture/types/architecture-records.types';
import { type RiskLevel as DirectRiskLevel } from '../src/primitives/types/primitives.types';
import { type ChatMessageRecord as DirectChatMessageRecord } from '../src/tasking/types/chat';
import { type TaskRecord as DirectTaskRecord } from '../src/tasking/types/task-record';
import { type DataReportJsonSchema as DirectDataReportJsonSchema } from '../src/data-report/types/data-report-json-schema';
import { type DataReportSandpackPayload as DirectDataReportSandpackPayload } from '../src/data-report/types/data-report';
import { type SkillCard as DirectSkillCard } from '../src/skills/types/skills.types';

describe('@agent/core contract export integration', () => {
  it('keeps tasking and report schemas aligned across root and direct domain barrels', () => {
    expect(ChatMessageRecordSchema).toBe(DirectChatMessageRecordSchema);

    expect(TaskRecordSchema).toBe(DirectTaskRecordSchema);

    expect(DataReportJsonSchemaSchema).toBe(DirectDataReportJsonSchemaSchema);

    expect(DataReportSandpackPayloadSchema).toBe(DirectDataReportSandpackPayloadSchema);

    expect(SkillCardSchema).toBe(DirectSkillCardSchema);

    expect(SpecialistFindingSchema).toBe(DirectSpecialistFindingSchema);

    expect(ConnectorHealthRecordSchema).toBe(DirectConnectorHealthRecordSchema);

    expect(BudgetStateSchema).toBe(DirectBudgetStateSchema);

    expect(CreateTaskDtoSchema).toBe(DirectCreateTaskDtoSchema);

    expect(ConnectorKnowledgeIngestionSummarySchema).toBe(DirectConnectorKnowledgeIngestionSummarySchema);

    expect(WorkflowRouteContextSchema).toBe(DirectWorkflowRouteContextSchema);

    expect(DeliveryCitationRecordSchema).toBe(DirectDeliveryCitationRecordSchema);

    expect(ExecutionTraceSchema).toBe(DirectExecutionTraceSchema);

    expect(InstallSkillDtoSchema).toBe(DirectInstallSkillDtoSchema);

    expect(PlatformApprovalRecordSchema).toBe(DirectPlatformApprovalRecordSchema);

    expect(ArchitectureDescriptorSchema).toBe(DirectArchitectureDescriptorSchema);

    expect(RiskLevelSchema).toBe(DirectRiskLevelSchema);
  });

  it('keeps helper exports aligned across root and direct domain entrypoints', () => {
    expect(isCitationEvidenceSource).toBe(DirectIsCitationEvidenceSource);

    const matchKey = buildApprovalScopeMatchKey({
      intent: 'write_file',
      toolName: 'filesystem.write',
      riskCode: 'high-risk',
      requestedBy: 'supervisor',
      commandPreview: 'write docs/core.md'
    });

    expect(matchKey).toBe('write_file::filesystem.write::high-risk::supervisor::write docs/core.md');
    expect(
      isCitationEvidenceSource({
        sourceType: 'web',
        sourceUrl: 'https://example.com',
        trustClass: 'official'
      })
    ).toBe(true);
  });

  it('keeps contract types aligned across root and physical contract hosts', () => {
    expectTypeOf<DataReportSandpackGenerateInput>().toEqualTypeOf<DirectDataReportSandpackGenerateInput>();

    expectTypeOf<DataReportJsonGenerateInput>().toEqualTypeOf<DirectDataReportJsonGenerateInput>();

    expectTypeOf<ArchitectureDescriptorRegistryEntry>().toEqualTypeOf<DirectArchitectureDescriptorRegistryEntry>();

    expectTypeOf<CreateTaskDto>().toEqualTypeOf<DirectCreateTaskDto>();

    expectTypeOf<ChatMessageRecord>().toEqualTypeOf<DirectChatMessageRecord>();
    expectTypeOf<TaskRecord>().toEqualTypeOf<DirectTaskRecord>();
    expectTypeOf<DataReportJsonSchema>().toEqualTypeOf<DirectDataReportJsonSchema>();
    expectTypeOf<DataReportSandpackPayload>().toEqualTypeOf<DirectDataReportSandpackPayload>();
    expectTypeOf<import('../src').SkillCard>().toEqualTypeOf<DirectSkillCard>();

    expectTypeOf<ConnectorKnowledgeIngestionSummary>().toEqualTypeOf<DirectConnectorKnowledgeIngestionSummary>();

    expectTypeOf<WorkflowRouteContext>().toEqualTypeOf<DirectWorkflowRouteContext>();

    expectTypeOf<DeliveryCitationRecord>().toEqualTypeOf<DirectDeliveryCitationRecord>();

    expectTypeOf<ExecutionTrace>().toEqualTypeOf<DirectExecutionTrace>();

    expectTypeOf<InstallSkillDto>().toEqualTypeOf<DirectInstallSkillDto>();

    expectTypeOf<PlatformApprovalRecord>().toEqualTypeOf<DirectPlatformApprovalRecord>();

    expectTypeOf<ArchitectureDescriptor>().toEqualTypeOf<DirectArchitectureDescriptor>();

    expectTypeOf<RiskLevel>().toEqualTypeOf<DirectRiskLevel>();
  });

  it('keeps chat and platform contract types aligned across root and physical contract hosts', () => {
    expectTypeOf<RuntimeAgentGraphState>().toEqualTypeOf<DirectRuntimeAgentGraphState>();

    expectTypeOf<AgentGraphHandlers>().toEqualTypeOf<DirectAgentGraphHandlers>();

    expectTypeOf<SharedPlatformConsoleRecord>().toEqualTypeOf<DirectSharedPlatformConsoleRecord>();
  });

  it('keeps ministry contract types aligned across root and physical contract hosts', () => {
    expectTypeOf<import('../src').RouterMinistryLike>().toEqualTypeOf<DirectRouterMinistryLike>();
    expectTypeOf<import('../src').ResearchMinistryLike>().toEqualTypeOf<DirectResearchMinistryLike>();
    expectTypeOf<import('../src').ReviewMinistryLike>().toEqualTypeOf<DirectReviewMinistryLike>();
    expectTypeOf<import('../src').DeliveryMinistryLike>().toEqualTypeOf<DirectDeliveryMinistryLike>();
    expectTypeOf<import('../src').CodeExecutionMinistryLike>().toEqualTypeOf<DirectCodeExecutionMinistryLike>();
    expectTypeOf<import('../src').OpsExecutionMinistryLike>().toEqualTypeOf<DirectOpsExecutionMinistryLike>();
  });
});
