import { Controller, Get } from '@nestjs/common';

import { KnowledgeGovernanceProjectionSchema } from '@agent/core';

import { RuntimeKnowledgeGovernanceService } from '../runtime/services/runtime-knowledge-governance.service';

@Controller('platform/knowledge')
export class KnowledgeGovernanceController {
  constructor(private readonly runtimeKnowledgeGovernanceService: RuntimeKnowledgeGovernanceService) {}

  @Get('governance')
  async getProjection() {
    return KnowledgeGovernanceProjectionSchema.parse(await this.runtimeKnowledgeGovernanceService.getProjection());
  }
}
