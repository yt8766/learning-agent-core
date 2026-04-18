import { z } from 'zod';

import {
  ChatCheckpointAgentStatesSchema,
  ChatCheckpointMetadataSchema,
  ChatCheckpointPendingApprovalsSchema,
  ChatCheckpointRecordSchema
} from '../schemas/checkpoint';

export type ChatCheckpointPendingApprovals = z.infer<typeof ChatCheckpointPendingApprovalsSchema>;
export type ChatCheckpointAgentStates = z.infer<typeof ChatCheckpointAgentStatesSchema>;
export type ChatCheckpointMetadata = z.infer<typeof ChatCheckpointMetadataSchema>;
export type ChatCheckpointRecord = z.infer<typeof ChatCheckpointRecordSchema>;
