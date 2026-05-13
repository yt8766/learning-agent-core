import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';

import { RuntimeWorkflowExecutionFacade } from '../../src/runtime/core/runtime-workflow-execution-facade';

vi.mock('../../src/company-live/company-live.dto', () => ({
  parseCompanyLiveGenerateDto: vi.fn().mockReturnValue({ briefId: 'b1' })
}));

vi.mock('../../src/runtime/core/runtime-company-live-facade', () => ({
  RuntimeCompanyLiveFacade: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      trace: [{ nodeId: 'n1', status: 'succeeded', durationMs: 100, inputSnapshot: {}, outputSnapshot: {} }]
    })
  }))
}));

vi.mock('../../src/runtime/core/runtime-data-report-facade', () => ({
  executeReportBundleGenerateFlow: vi.fn().mockResolvedValue({
    status: 'succeeded',
    runtime: {
      jsonRuntime: {
        nodeDurations: { 'gen-json': 200, validate: 50 }
      }
    }
  })
}));

describe('RuntimeWorkflowExecutionFacade', () => {
  let facade: RuntimeWorkflowExecutionFacade;

  beforeEach(() => {
    const mockCompanyLiveFacade = {
      generate: vi.fn().mockResolvedValue({
        trace: [{ nodeId: 'n1', status: 'succeeded', durationMs: 100, inputSnapshot: {}, outputSnapshot: {} }]
      })
    };
    facade = new RuntimeWorkflowExecutionFacade(mockCompanyLiveFacade as any);
  });

  describe('listWorkflowIds', () => {
    it('returns registered workflow IDs', () => {
      const ids = facade.listWorkflowIds();

      expect(ids).toContain('company-live');
      expect(ids).toContain('data-report-json');
    });
  });

  describe('executeWorkflow', () => {
    it('executes company-live workflow and returns output', async () => {
      const result = await facade.executeWorkflow({
        workflowId: 'company-live',
        input: { briefId: 'b1', targetPlatform: 'douyin' }
      } as any);

      expect(result).toBeDefined();
    });

    it('throws NotFoundException for unknown workflow', async () => {
      await expect(
        facade.executeWorkflow({
          workflowId: 'unknown-workflow',
          input: {}
        } as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('re-throws non NotFoundException errors', async () => {
      const mockGenerate = vi.fn().mockRejectedValue(new Error('internal'));
      const failingFacade = new RuntimeWorkflowExecutionFacade({ generate: mockGenerate } as any);

      await expect(
        failingFacade.executeWorkflow({
          workflowId: 'company-live',
          input: { briefId: 'b1' }
        } as any)
      ).rejects.toThrow('internal');
    });
  });
});
