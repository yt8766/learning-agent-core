import { z } from 'zod';

import {
  ApprovalDecisionRecordSchema,
  PlatformApprovalInterruptRecordSchema,
  PlatformApprovalMicroBudgetRecordSchema,
  PlatformApprovalPlanDraftRecordSchema,
  PlatformApprovalPreviewItemSchema,
  PlatformApprovalQuestionSetRecordSchema,
  PlatformApprovalRecordSchema
} from '../spec/platform-console';

export type ApprovalDecisionRecord = z.infer<typeof ApprovalDecisionRecordSchema>;
export type PlatformApprovalPreviewItem = z.infer<typeof PlatformApprovalPreviewItemSchema>;
export type PlatformApprovalInterruptRecord = z.infer<typeof PlatformApprovalInterruptRecordSchema>;
export type PlatformApprovalQuestionSetRecord = z.infer<typeof PlatformApprovalQuestionSetRecordSchema>;
export type PlatformApprovalMicroBudgetRecord = z.infer<typeof PlatformApprovalMicroBudgetRecordSchema>;
export type PlatformApprovalPlanDraftRecord = z.infer<typeof PlatformApprovalPlanDraftRecordSchema>;
export type PlatformApprovalRecord = z.infer<typeof PlatformApprovalRecordSchema>;
