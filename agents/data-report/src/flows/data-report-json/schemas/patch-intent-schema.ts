import { z } from 'zod';

export const dataReportJsonPatchTargetSchema = z.enum([
  'filterSchema',
  'dataSources',
  'metricsBlock',
  'chartBlock',
  'tableBlock'
]);

export const dataReportJsonPatchIntentSchema = z.object({
  target: dataReportJsonPatchTargetSchema,
  action: z.enum([
    'add',
    'remove',
    'update-title',
    'update-style',
    'update-component',
    'regenerate-options',
    'update-default',
    'unknown'
  ]),
  subject: z.string().optional()
});

export const dataReportJsonPatchIntentBundleSchema = z.object({
  intents: z.array(dataReportJsonPatchIntentSchema).default([])
});
