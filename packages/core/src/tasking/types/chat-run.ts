import type { z } from 'zod';

import type {
  ChatRunRecordSchema,
  ChatRunRouteSchema,
  ChatRunStatusSchema,
  ChatRunTokenUsageSchema
} from '../schemas/chat-run';

export type ChatRunRoute = z.infer<typeof ChatRunRouteSchema>;
export type ChatRunStatus = z.infer<typeof ChatRunStatusSchema>;
export type ChatRunTokenUsage = z.infer<typeof ChatRunTokenUsageSchema>;
export type ChatRunRecord = z.infer<typeof ChatRunRecordSchema>;
