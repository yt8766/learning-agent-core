import type { DataReportAssemblyResult } from '../assembly/data-report-assembly';
import type { DataReportModuleScaffoldResult } from '../scaffold/data-report-module-scaffold';
import type { DataReportScaffoldFile } from '../scaffold/data-report-scaffold';

export function collectDataReportBundleFiles(params: {
  moduleResults: DataReportModuleScaffoldResult[];
  sharedFiles: DataReportScaffoldFile[];
  routeFiles: DataReportScaffoldFile[];
}): DataReportScaffoldFile[] {
  const byPath = new Map<string, DataReportScaffoldFile>();

  for (const file of params.sharedFiles) {
    byPath.set(file.path, file);
  }

  for (const file of params.routeFiles) {
    byPath.set(file.path, file);
  }

  for (const moduleResult of params.moduleResults) {
    for (const file of moduleResult.files) {
      if (!byPath.has(file.path)) {
        byPath.set(file.path, file);
      }
    }
  }

  return Array.from(byPath.values());
}

export function collectDataReportBundleFilesFromAssembly(bundle: DataReportAssemblyResult): DataReportScaffoldFile[] {
  return collectDataReportBundleFiles({
    moduleResults: bundle.moduleResults,
    sharedFiles: bundle.sharedFiles,
    routeFiles: bundle.routeFiles ?? []
  });
}
