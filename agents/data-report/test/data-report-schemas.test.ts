import { describe, expect, it } from 'vitest';

import {
  dataReportJsonPatchIntentBundleSchema,
  dataReportJsonPatchIntentSchema
} from '../src/flows/data-report-json/schemas';
import {
  dataReportSandpackPayloadSchema,
  normalizeDataReportSandpackFiles,
  parseDataReportSandpackPayload
} from '../src/flows/data-report/schemas';

describe('@agent/agents-data-report schema contracts', () => {
  it('defaults empty patch intent bundles to an empty intents array', () => {
    expect(dataReportJsonPatchIntentBundleSchema.parse({})).toEqual({
      intents: []
    });
  });

  it('rejects invalid patch actions', () => {
    expect(() =>
      dataReportJsonPatchIntentSchema.parse({
        target: 'tableBlock',
        action: 'rewrite-everything'
      })
    ).toThrow(/invalid option/i);
  });

  it('normalizes sandpack file paths during payload parsing', () => {
    const payload = parseDataReportSandpackPayload({
      status: 'success',
      files: {
        'pages/dashboard/index.tsx': 'export default function Dashboard() { return null; }',
        'package.json': '{"name":"demo"}'
      }
    });

    expect(dataReportSandpackPayloadSchema.parse({ status: 'success', files: payload.files })).toEqual({
      status: 'success',
      files: {
        '/src/pages/dashboard/index.tsx': 'export default function Dashboard() { return null; }',
        '/package.json': '{"name":"demo"}'
      }
    });
  });

  it('keeps existing /src paths stable during sandpack file normalization', () => {
    expect(
      normalizeDataReportSandpackFiles({
        '/src/pages/dataDashboard/demo/index.tsx': 'export default function Demo() { return null; }'
      })
    ).toEqual({
      '/src/pages/dataDashboard/demo/index.tsx': 'export default function Demo() { return null; }'
    });
  });
});
