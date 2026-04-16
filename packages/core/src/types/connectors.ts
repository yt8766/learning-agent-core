import { z } from 'zod';

import type { CapabilityGovernanceProfileRecord, GovernanceProfileRecord } from '@agent/shared';

import type {
  ApprovalPolicyRecord,
  ApprovalScopePolicyRecord,
  ConnectorHealthRecord,
  McpCapability
} from './governance';

export type SharedConnectorHealthRecord = ConnectorHealthRecord;
export type SharedApprovalPolicyRecord = ApprovalPolicyRecord;
export type SharedApprovalScopePolicyRecord = ApprovalScopePolicyRecord;
export type SharedMcpCapability = McpCapability;
export type SharedCapabilityGovernanceProfileRecord = CapabilityGovernanceProfileRecord;
export type SharedGovernanceProfileRecord = GovernanceProfileRecord;

export const ConnectorKnowledgeIngestionSummarySchema = z.object({
  sourceCount: z.number(),
  searchableDocumentCount: z.number(),
  blockedDocumentCount: z.number(),
  latestReceiptIds: z.array(z.string())
});

export type ConnectorKnowledgeIngestionSummary = z.infer<typeof ConnectorKnowledgeIngestionSummarySchema>;

export const ConnectorCapabilityUsageRecordSchema = z.object({
  taskId: z.string(),
  goal: z.string(),
  status: z.string(),
  approvalCount: z.number(),
  latestTraceSummary: z.string().optional()
});

export type ConnectorCapabilityUsageRecord = z.infer<typeof ConnectorCapabilityUsageRecordSchema>;
