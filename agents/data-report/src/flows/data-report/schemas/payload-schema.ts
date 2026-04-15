import { z } from 'zod';

import type { DataReportSandpackFiles, DataReportSandpackPayload } from '../../../types/data-report';

export const dataReportSandpackFilesSchema = z
  .record(z.string(), z.string())
  .refine(files => Object.keys(files).length > 0, 'Sandpack response files cannot be empty.');

export const dataReportSandpackPayloadSchema = z.object({
  status: z.literal('success'),
  files: dataReportSandpackFilesSchema
});

export function parseDataReportSandpackPayload(input: unknown): DataReportSandpackPayload {
  const parsed = dataReportSandpackPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid Sandpack payload.';
    throw new Error(message);
  }

  return {
    status: parsed.data.status,
    files: normalizeDataReportSandpackFiles(parsed.data.files)
  };
}

export function normalizeDataReportSandpackFiles(files: Record<string, string>): DataReportSandpackFiles {
  return Object.fromEntries(
    Object.entries(files).map(([filePath, code]) => [normalizeDataReportSandpackFilePath(filePath), code])
  );
}

function normalizeDataReportSandpackFilePath(filePath: string) {
  const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;

  if (/^\/src\//.test(normalized) || normalized === '/package.json' || normalized === '/tsconfig.json') {
    return normalized;
  }

  if (/^\/(pages|services|types)\//.test(normalized)) {
    return `/src${normalized}`;
  }

  return normalized;
}
