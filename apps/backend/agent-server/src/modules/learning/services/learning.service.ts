import { Injectable } from '@nestjs/common';

import { CreateDocumentLearningJobDto, CreateResearchLearningJobDto } from '@agent/core';

import { RuntimeCentersService } from '../../../runtime/centers/runtime-centers.service';
import { RuntimeTaskService } from '../../../runtime/services/runtime-task.service';

@Injectable()
export class LearningService {
  constructor(
    private readonly runtimeCentersService: RuntimeCentersService,
    private readonly runtimeTaskService: RuntimeTaskService
  ) {}

  getCenter() {
    return this.runtimeCentersService.getLearningCenter();
  }

  createDocumentLearningJob(dto: CreateDocumentLearningJobDto) {
    return this.runtimeTaskService.createDocumentLearningJob(dto);
  }

  createResearchLearningJob(dto: CreateResearchLearningJobDto) {
    return this.runtimeTaskService.createResearchLearningJob(dto);
  }

  getLearningJob(id: string) {
    return this.runtimeTaskService.getLearningJob(id);
  }
}
