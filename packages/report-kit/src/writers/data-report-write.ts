import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { DataReportAssemblyResult } from '../assembly/data-report-assembly';
import { collectDataReportBundleFilesFromAssembly } from '../shared/data-report-bundle-files';

export interface DataReportWriteResult {
  targetRoot: string;
  totalWritten: number;
  writtenFiles: string[];
  skippedFiles: string[];
}

export async function writeDataReportBundle(params: {
  bundle: DataReportAssemblyResult;
  targetRoot: string;
}): Promise<DataReportWriteResult> {
  const targetRoot = resolve(params.targetRoot);
  const files = collectDataReportBundleFilesFromAssembly(params.bundle);
  const writtenFiles: string[] = [];

  for (const file of files) {
    const outputPath = resolve(targetRoot, file.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, file.content, 'utf8');
    writtenFiles.push(outputPath);
  }

  return {
    targetRoot,
    totalWritten: writtenFiles.length,
    writtenFiles,
    skippedFiles: []
  };
}
