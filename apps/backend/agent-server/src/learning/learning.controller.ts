import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateDocumentLearningJobDto } from '@agent/shared';

import { LearningService } from './learning.service';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Post('documents')
  createDocumentLearningJob(@Body() dto: CreateDocumentLearningJobDto) {
    return this.learningService.createDocumentLearningJob(dto);
  }

  @Get('jobs/:id')
  getLearningJob(@Param('id') id: string) {
    return this.learningService.getLearningJob(id);
  }
}
