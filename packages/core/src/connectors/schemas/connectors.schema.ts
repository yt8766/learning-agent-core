import { z } from 'zod';

export const ConnectorKnowledgeIngestionSummarySchema = z.object({
  sourceCount: z.number(),
  searchableDocumentCount: z.number(),
  blockedDocumentCount: z.number(),
  latestReceiptIds: z.array(z.string())
});

export const ConnectorCapabilityUsageRecordSchema = z.object({
  taskId: z.string(),
  goal: z.string(),
  status: z.string(),
  approvalCount: z.number(),
  latestTraceSummary: z.string().optional()
});
