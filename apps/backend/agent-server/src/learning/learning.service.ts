import { Injectable } from '@nestjs/common';

import { CreateDocumentLearningJobDto, CreateResearchLearningJobDto } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class LearningService {
  constructor(private readonly runtimeService: RuntimeService) {}

  getCenter() {
    return this.runtimeService.getLearningCenter();
  }

  createDocumentLearningJob(dto: CreateDocumentLearningJobDto) {
    return this.runtimeService.createDocumentLearningJob(dto);
  }

  createResearchLearningJob(dto: CreateResearchLearningJobDto) {
    return this.runtimeService.createResearchLearningJob(dto);
  }

  getLearningJob(id: string) {
    return this.runtimeService.getLearningJob(id);
  }
}
