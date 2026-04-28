import { z } from 'zod';

import {
  ReportBundleModeSchema,
  ReportBundleSchema,
  ReportDocumentSchema,
  ReportPatchOperationSchema
} from './schemas/report-bundle';

export type ReportBundleMode = z.infer<typeof ReportBundleModeSchema>;
export type ReportDocument = z.infer<typeof ReportDocumentSchema>;
export type ReportPatchOperation = z.infer<typeof ReportPatchOperationSchema>;
export type ReportBundle = z.infer<typeof ReportBundleSchema>;
