import { z } from 'zod/v4';

export const DataReportAnalysisSchema = z.object({
  reportType: z.literal('data-dashboard'),
  requiresSandpack: z.literal(true),
  requiresMultiFileOutput: z.literal(true),
  title: z.string().min(1),
  routeName: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
  templateId: z.string().min(1),
  referenceMode: z.enum(['single', 'multiple', 'shell-first']),
  dataSourceHint: z.string().optional(),
  keywords: z.array(z.string()).min(1)
});

export const DataReportIntentSchema = z.object({
  action: z.literal('generate-report-page'),
  routeName: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
  moduleBasePath: z.string().regex(/^\/pages\/dataDashboard\/[A-Za-z][A-Za-z0-9]*$/),
  serviceBaseName: z.string().regex(/^[a-z][A-Za-z0-9]*$/)
});

export const DataReportComponentPlanSchema = z.object({
  singleReportMode: z.enum(['page-only', 'component-files']).optional(),
  planned: z.array(
    z.object({
      name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/),
      path: z
        .string()
        .regex(/^\/pages\/dataDashboard\/[A-Za-z][A-Za-z0-9]*(?:\/components\/[A-Z][A-Za-z0-9]*(?:\/index)?\.tsx)?$/),
      purpose: z.string().min(1)
    })
  )
});

export const DataReportServiceSchema = z.object({
  plannedFile: z.string().regex(/^\/services\/data\/[A-Za-z][A-Za-z0-9]*\.ts$/),
  exportName: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/)
});

export const DataReportHooksSchema = z.object({
  planned: z.array(
    z.object({
      name: z.string().regex(/^use[A-Z][A-Za-z0-9]*$/),
      path: z.string().regex(/^\/pages\/dataDashboard\/[A-Za-z][A-Za-z0-9]*\/hooks\/use[A-Z][A-Za-z0-9]*\.ts$/)
    })
  )
});

export const DataReportStyleSchema = z.object({
  target: z.literal('tailwind-inline'),
  theme: z.literal('bonus-center')
});
