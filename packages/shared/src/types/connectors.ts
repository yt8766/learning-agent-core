import type {
  ApprovalPolicyRecord,
  ApprovalScopePolicyRecord,
  ConnectorHealthRecord,
  McpCapability
} from './governance';
import type { CapabilityGovernanceProfileRecord, GovernanceProfileRecord } from './skills';

export type SharedConnectorHealthRecord = ConnectorHealthRecord;
export type SharedApprovalPolicyRecord = ApprovalPolicyRecord;
export type SharedApprovalScopePolicyRecord = ApprovalScopePolicyRecord;
export type SharedMcpCapability = McpCapability;
export type SharedCapabilityGovernanceProfileRecord = CapabilityGovernanceProfileRecord;
export type SharedGovernanceProfileRecord = GovernanceProfileRecord;

export interface ConnectorKnowledgeIngestionSummary {
  sourceCount: number;
  searchableDocumentCount: number;
  blockedDocumentCount: number;
  latestReceiptIds: string[];
}

export interface ConnectorCapabilityUsageRecord {
  taskId: string;
  goal: string;
  status: string;
  approvalCount: number;
  latestTraceSummary?: string;
}
