import type { DataReportBlueprintResult } from '../blueprints/data-report-blueprint';
import type { DataReportScaffoldFile } from '../scaffold/data-report-scaffold';

export interface DataReportRouteResult {
  blueprint: DataReportBlueprintResult;
  files: DataReportScaffoldFile[];
}

export function buildDataReportRoutes(blueprint: DataReportBlueprintResult): DataReportRouteResult {
  const pageImportPath = resolvePrimaryPageImport(blueprint);

  return {
    blueprint,
    files: [
      {
        path: 'App.tsx',
        content: buildAppFileContent(pageImportPath),
        description: 'generated preview app entry for sandpack'
      }
    ]
  };
}

function resolvePrimaryPageImport(blueprint: DataReportBlueprintResult): string {
  if (blueprint.templateId === 'bonus-center-data') {
    return `./src/pages/dataDashboard/${blueprint.routeName}`;
  }

  if (blueprint.pageDir === `${blueprint.baseDir}`) {
    return `./${blueprint.baseDir}/index`;
  }

  return `./${blueprint.pageDir}/index`;
}

function buildAppFileContent(pageImportPath: string) {
  return `import ReportPage from '${pageImportPath}';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ReportPage />
    </main>
  );
}
`;
}
