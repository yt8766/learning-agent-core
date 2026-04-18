import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { InvalidateKnowledgeDto, RetireKnowledgeDto, SupersedeKnowledgeDto } from '@agent/core';

import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  list() {
    return this.rulesService.list();
  }

  @Post(':id/invalidate')
  invalidate(@Param('id') id: string, @Body() dto: InvalidateKnowledgeDto) {
    return this.rulesService.invalidate(id, dto);
  }

  @Post(':id/supersede')
  supersede(@Param('id') id: string, @Body() dto: SupersedeKnowledgeDto) {
    return this.rulesService.supersede(id, dto);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.rulesService.restore(id);
  }

  @Post(':id/retire')
  retire(@Param('id') id: string, @Body() dto: RetireKnowledgeDto) {
    return this.rulesService.retire(id, dto);
  }
}
