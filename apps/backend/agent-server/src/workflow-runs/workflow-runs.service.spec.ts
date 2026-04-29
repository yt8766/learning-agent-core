import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowRunsService } from './workflow-runs.service';

describe('WorkflowRunsService', () => {
  let service: WorkflowRunsService;
  let repository: Repository<WorkflowRun>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowRunsService,
        {
          provide: getRepositoryToken(WorkflowRun),
          useValue: {
            find: jest.fn().mockResolvedValue([])
          }
        }
      ]
    }).compile();

    service = module.get<WorkflowRunsService>(WorkflowRunsService);
    repository = module.get<Repository<WorkflowRun>>(getRepositoryToken(WorkflowRun));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get workflow runs', async () => {
    const result = [];
    jest.spyOn(repository, 'find').mockResolvedValueOnce(result);

    expect(await service.getWorkflowRuns()).toBe(result);
  });
});
