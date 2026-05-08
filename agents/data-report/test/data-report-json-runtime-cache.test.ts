import { describe, expect, it } from 'vitest';

import { DATA_REPORT_JSON_ARTIFACT_CACHE_PATH } from '../src/flows/data-report-json/runtime-cache';

describe('data-report json runtime cache', () => {
  it('uses explicit artifact storage instead of root data runtime by default', () => {
    expect(DATA_REPORT_JSON_ARTIFACT_CACHE_PATH).toContain('artifacts/runtime/data-report-json-artifacts.json');
    expect(DATA_REPORT_JSON_ARTIFACT_CACHE_PATH).not.toContain('data/runtime');
  });
});
