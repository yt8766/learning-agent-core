import { Injectable } from '@nestjs/common';

import { CreateDocumentLearningJobDto } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class LearningService {
  constructor(private readonly runtimeService: RuntimeService) {}

  createDocumentLearningJob(dto: CreateDocumentLearningJobDto) {
    return this.runtimeService.createDocumentLearningJob(dto);
  }

  getLearningJob(id: string) {
    return this.runtimeService.getLearningJob(id);
  }
}
