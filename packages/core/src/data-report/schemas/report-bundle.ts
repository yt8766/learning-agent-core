import { z } from 'zod';

import { DataReportJsonPatchOperationSchema, DataReportJsonSchemaSchema } from './data-report-json-schema';

export const ReportBundleModeSchema = z.enum(['single-document', 'multi-document']);

export const ReportDocumentSchema = DataReportJsonSchemaSchema;

export const ReportPatchOperationSchema = DataReportJsonPatchOperationSchema;

export const ReportBundleSchema = z.object({
  version: z.literal('report-bundle.v1'),
  kind: z.literal('report-bundle'),
  meta: z.object({
    bundleId: z.string().min(1),
    title: z.string().min(1),
    mode: ReportBundleModeSchema
  }),
  documents: z.array(ReportDocumentSchema),
  patchOperations: z.array(ReportPatchOperationSchema).optional(),
  warnings: z.array(z.string()).optional()
});
