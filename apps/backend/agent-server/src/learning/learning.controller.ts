import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateDocumentLearningJobDto, CreateResearchLearningJobDto } from '@agent/core';

import { LearningService } from './learning.service';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('center')
  getCenter() {
    return this.learningService.getCenter();
  }

  @Post('documents')
  createDocumentLearningJob(@Body() dto: CreateDocumentLearningJobDto) {
    return this.learningService.createDocumentLearningJob(dto);
  }

  @Post('research')
  createResearchLearningJob(@Body() dto: CreateResearchLearningJobDto) {
    return this.learningService.createResearchLearningJob(dto);
  }

  @Get('jobs/:id')
  getLearningJob(@Param('id') id: string) {
    return this.learningService.getLearningJob(id);
  }
}
