import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { DataReportAssemblyResult } from './data-report-assembly';
import type { DataReportScaffoldFile } from './data-report-scaffold';

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
  const files = collectBundleFiles(params.bundle);
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

function collectBundleFiles(bundle: DataReportAssemblyResult): DataReportScaffoldFile[] {
  const byPath = new Map<string, DataReportScaffoldFile>();

  for (const file of bundle.sharedFiles) {
    byPath.set(file.path, file);
  }

  for (const file of bundle.routeFiles ?? []) {
    byPath.set(file.path, file);
  }

  for (const moduleResult of bundle.moduleResults) {
    for (const file of moduleResult.files) {
      if (!byPath.has(file.path)) {
        byPath.set(file.path, file);
      }
    }
  }

  return Array.from(byPath.values());
}
