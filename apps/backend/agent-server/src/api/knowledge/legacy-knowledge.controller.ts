import { Controller, Get } from '@nestjs/common';

import { KnowledgeBaseService } from '../../domains/knowledge/services/knowledge-base.service';

@Controller('knowledge/v1')
export class LegacyKnowledgeController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get('bases')
  listBases() {
    return this.knowledgeBaseService.listBases();
  }
}
