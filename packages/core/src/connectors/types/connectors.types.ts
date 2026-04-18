import { z } from 'zod';

import {
  ConnectorCapabilityUsageRecordSchema,
  ConnectorKnowledgeIngestionSummarySchema
} from '../schemas/connectors.schema';

export type ConnectorKnowledgeIngestionSummary = z.infer<typeof ConnectorKnowledgeIngestionSummarySchema>;
export type ConnectorCapabilityUsageRecord = z.infer<typeof ConnectorCapabilityUsageRecordSchema>;
