import { z } from 'zod';

import type {
  ApprovalPolicyRecord,
  ApprovalScopePolicyRecord,
  ConnectorHealthRecord,
  McpCapability
} from './governance';
import type { CapabilityGovernanceProfileRecord, GovernanceProfileRecord } from './skills';
import { ConnectorCapabilityUsageRecordSchema, ConnectorKnowledgeIngestionSummarySchema } from '../spec/connectors';

export type SharedConnectorHealthRecord = ConnectorHealthRecord;
export type SharedApprovalPolicyRecord = ApprovalPolicyRecord;
export type SharedApprovalScopePolicyRecord = ApprovalScopePolicyRecord;
export type SharedMcpCapability = McpCapability;
export type SharedCapabilityGovernanceProfileRecord = CapabilityGovernanceProfileRecord;
export type SharedGovernanceProfileRecord = GovernanceProfileRecord;

export type ConnectorKnowledgeIngestionSummary = z.infer<typeof ConnectorKnowledgeIngestionSummarySchema>;

export type ConnectorCapabilityUsageRecord = z.infer<typeof ConnectorCapabilityUsageRecordSchema>;
