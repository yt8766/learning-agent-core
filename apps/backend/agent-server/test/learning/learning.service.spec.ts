import { describe, expect, it, vi } from 'vitest';

import type { CreateDocumentLearningJobDto, CreateResearchLearningJobDto } from '@agent/core';

import { LearningService } from '../../src/learning/learning.service';

describe('LearningService', () => {
  it('delegates center loading to RuntimeCentersService', () => {
    const runtimeCentersService = {
      getLearningCenter: vi.fn().mockReturnValue({ candidates: [] })
    };
    const runtimeTaskService = {
      createDocumentLearningJob: vi.fn(),
      createResearchLearningJob: vi.fn(),
      getLearningJob: vi.fn()
    };
    const service = new LearningService(runtimeCentersService as any, runtimeTaskService as any);

    expect(service.getCenter()).toEqual({ candidates: [] });
    expect(runtimeCentersService.getLearningCenter).toHaveBeenCalledTimes(1);
  });

  it('delegates learning job actions to RuntimeTaskService', () => {
    const runtimeCentersService = {
      getLearningCenter: vi.fn()
    };
    const runtimeTaskService = {
      createDocumentLearningJob: vi.fn(),
      createResearchLearningJob: vi.fn(),
      getLearningJob: vi.fn()
    };
    const service = new LearningService(runtimeCentersService as any, runtimeTaskService as any);
    const documentDto = { documentId: 'doc-1' } as CreateDocumentLearningJobDto;
    const researchDto = { taskId: 'task-1' } as CreateResearchLearningJobDto;

    service.createDocumentLearningJob(documentDto);
    service.createResearchLearningJob(researchDto);
    service.getLearningJob('job-1');

    expect(runtimeTaskService.createDocumentLearningJob).toHaveBeenCalledWith(documentDto);
    expect(runtimeTaskService.createResearchLearningJob).toHaveBeenCalledWith(researchDto);
    expect(runtimeTaskService.getLearningJob).toHaveBeenCalledWith('job-1');
  });
});
