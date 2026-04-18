import { z } from 'zod';

import {
  CheckpointRefSchema,
  ThoughtGraphEdgeSchema,
  ThoughtGraphNodeSchema,
  ThoughtGraphRecordSchema
} from '../schemas/thought-graph';

export type CheckpointRef = z.infer<typeof CheckpointRefSchema>;
export type ThoughtGraphNode = z.infer<typeof ThoughtGraphNodeSchema>;
export type ThoughtGraphEdge = z.infer<typeof ThoughtGraphEdgeSchema>;
export type ThoughtGraphRecord = z.infer<typeof ThoughtGraphRecordSchema>;
