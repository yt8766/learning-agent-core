import { z } from 'zod';

import { MemoryScopeTypeSchema } from './memory-record.schema';

export const UserProfileRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  scopeType: MemoryScopeTypeSchema.default('user'),
  identity: z.string().optional(),
  role: z.string().optional(),
  team: z.string().optional(),
  goals: z.array(z.string()).optional(),
  communicationStyle: z.string().optional(),
  executionStyle: z.string().optional(),
  approvalStyle: z.string().optional(),
  riskTolerance: z.string().optional(),
  codingPreferences: z.array(z.string()).optional(),
  toolPreferences: z.array(z.string()).optional(),
  productFocus: z.array(z.string()).optional(),
  doNotDo: z.array(z.string()).default([]),
  privacyFlags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type UserProfileRecord = z.infer<typeof UserProfileRecordSchema>;
