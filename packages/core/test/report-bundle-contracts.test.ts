import { describe, expect, it } from 'vitest';

import { ReportBundleSchema } from '../src/data-report/schemas/report-bundle';

describe('@agent/core report bundle contracts', () => {
  it('parses a single-document bundle with patch operations', () => {
    const parsed = ReportBundleSchema.parse({
      version: 'report-bundle.v1',
      kind: 'report-bundle',
      meta: { bundleId: 'bundle-1', title: 'Bonus Center', mode: 'single-document' },
      documents: [
        {
          version: '1.0',
          kind: 'data-report-json',
          meta: {
            reportId: 'bonusCenterData',
            title: 'Bonus Center',
            description: 'Bonus Center 数据报表',
            route: '/dataDashboard/bonusCenterData',
            templateRef: 'bonus-center-data',
            scope: 'multiple',
            layout: 'dashboard',
            owner: 'data-report-json-agent'
          },
          pageDefaults: {
            filters: {},
            queryPolicy: {
              autoQueryOnInit: true,
              autoQueryOnFilterChange: false,
              cacheKey: 'bonusCenterData'
            }
          },
          filterSchema: { formKey: 'search', layout: 'inline', fields: [] },
          dataSources: {},
          sections: [],
          registries: {
            filterComponents: [],
            blockTypes: ['metrics', 'chart', 'table'],
            serviceKeys: []
          },
          modification: { strategy: 'patchable-json', supportedOperations: ['update-filter-defaults'] },
          patchOperations: [
            {
              op: 'replace-meta-title',
              path: '$.meta.title',
              summary: 'rename document title'
            }
          ],
          warnings: []
        }
      ],
      patchOperations: [
        {
          op: 'replace-meta-title',
          path: '$.documents[0].meta.title',
          summary: 'rename bundle primary document title'
        }
      ]
    });

    expect(parsed.documents).toHaveLength(1);
    expect(parsed.patchOperations?.[0]?.op).toBe('replace-meta-title');
  });
});
