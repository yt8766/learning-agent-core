import { z } from 'zod';

import {
  DataReportJsonBundleChartSchema,
  DataReportJsonBundleComponentPlanSchema,
  DataReportJsonBundleFieldSchema,
  DataReportJsonBundleFieldValueTypeSchema,
  DataReportJsonBundleFilePlanSchema,
  DataReportJsonBundleFormatterSchema,
  DataReportJsonBundleMetricSchema,
  DataReportJsonBundleReportSchema,
  DataReportJsonBundleSchema,
  DataReportJsonBundleServiceSchema,
  DataReportJsonBundleTableSchema
} from './schemas/data-report-json-bundle-schema';

export type DataReportJsonBundleFieldValueType = z.infer<typeof DataReportJsonBundleFieldValueTypeSchema>;
export type DataReportJsonBundleField = z.infer<typeof DataReportJsonBundleFieldSchema>;
export type DataReportJsonBundleFormatter = z.infer<typeof DataReportJsonBundleFormatterSchema>;
export type DataReportJsonBundleService = z.infer<typeof DataReportJsonBundleServiceSchema>;
export type DataReportJsonBundleMetric = z.infer<typeof DataReportJsonBundleMetricSchema>;
export type DataReportJsonBundleChart = z.infer<typeof DataReportJsonBundleChartSchema>;
export type DataReportJsonBundleTable = z.infer<typeof DataReportJsonBundleTableSchema>;
export type DataReportJsonBundleComponentPlan = z.infer<typeof DataReportJsonBundleComponentPlanSchema>;
export type DataReportJsonBundleReport = z.infer<typeof DataReportJsonBundleReportSchema>;
export type DataReportJsonBundleFilePlan = z.infer<typeof DataReportJsonBundleFilePlanSchema>;
export type DataReportJsonBundle = z.infer<typeof DataReportJsonBundleSchema>;
