import { describe, expect, it } from 'vitest';

import { LocalSandboxExecutor } from '../src/sandbox/sandbox-executor';

describe('sandbox report artifact defaults', () => {
  it('materializes data-report bundles into explicit artifact storage by default', async () => {
    const executor = new LocalSandboxExecutor();

    const result = await executor.execute({
      toolName: 'write_data_report_bundle',
      intent: 'write_file',
      input: {
        bundle: {
          moduleResults: [],
          sharedFiles: [],
          routeFiles: [],
          assemblyPlan: {
            totalFiles: 0,
            moduleArtifacts: [],
            sharedArtifacts: [],
            routeArtifacts: [],
            deliveryManifest: [],
            postProcessSummary: {
              updatedFiles: [],
              skippedFiles: [],
              errors: []
            }
          },
          sandpackFiles: {}
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.outputSummary).toContain('artifacts/report-kit/data-report-output');
    expect(result.outputSummary).not.toContain('data/generated');
    expect(result.rawOutput).toMatchObject({ totalWritten: 0 });
    expect(JSON.stringify(result.rawOutput)).toContain('artifacts/report-kit/data-report-output');
    expect(JSON.stringify(result.rawOutput)).not.toContain('data/generated');
  });
});
