import { describe, expect, it } from 'vitest';

import {
  appendDataReportContext,
  buildDataReportContract,
  createDataReportJsonGraph,
  createDataReportSandpackGraph,
  executeDataReportJsonGraph,
  executeDataReportSandpackGraph,
  generateDataReportPreview,
  parseDataReportJsonSchema,
  parseDataReportSandpackPayload
} from '../src';
import {
  appendDataReportContext as canonicalAppendDataReportContext,
  buildDataReportContract as canonicalBuildDataReportContract
} from '../src/flows/data-report/contract';
import { parseDataReportSandpackPayload as canonicalParseDataReportSandpackPayload } from '../src/flows/data-report/schemas';
import { executeDataReportJsonGraph as canonicalExecuteDataReportJsonGraph } from '../src/flows/data-report-json/runtime';
import { parseDataReportJsonSchema as canonicalParseDataReportJsonSchema } from '../src/flows/data-report-json/schemas';
import { executeDataReportSandpackGraph as canonicalExecuteDataReportSandpackGraph } from '../src/flows/data-report/runtime';
import { generateDataReportPreview as canonicalGenerateDataReportPreview } from '../src/flows/data-report/preview';
import { createDataReportJsonGraph as canonicalCreateDataReportJsonGraph } from '../src/graphs/data-report-json.graph';
import { createDataReportSandpackGraph as canonicalCreateDataReportSandpackGraph } from '../src/graphs/data-report.graph';

describe('@agent/agents-data-report root exports', () => {
  it('keeps stable data-report exports wired to canonical hosts', () => {
    expect(createDataReportSandpackGraph).toBe(canonicalCreateDataReportSandpackGraph);
    expect(createDataReportJsonGraph).toBe(canonicalCreateDataReportJsonGraph);
    expect(buildDataReportContract).toBe(canonicalBuildDataReportContract);
    expect(appendDataReportContext).toBe(canonicalAppendDataReportContext);
    expect(generateDataReportPreview).toBe(canonicalGenerateDataReportPreview);
    expect(executeDataReportSandpackGraph).toBe(canonicalExecuteDataReportSandpackGraph);
    expect(executeDataReportJsonGraph).toBe(canonicalExecuteDataReportJsonGraph);
    expect(parseDataReportSandpackPayload).toBe(canonicalParseDataReportSandpackPayload);
    expect(parseDataReportJsonSchema).toBe(canonicalParseDataReportJsonSchema);
  });
});
