import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { InvalidateKnowledgeDto, RetireKnowledgeDto, SearchMemoryDto, SupersedeKnowledgeDto } from '@agent/shared';

import { MemoryService } from './memory.service';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post('search')
  search(@Body() dto: SearchMemoryDto) {
    return this.memoryService.search(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.memoryService.getById(id);
  }

  @Post(':id/invalidate')
  invalidate(@Param('id') id: string, @Body() dto: InvalidateKnowledgeDto) {
    return this.memoryService.invalidate(id, dto);
  }

  @Post(':id/supersede')
  supersede(@Param('id') id: string, @Body() dto: SupersedeKnowledgeDto) {
    return this.memoryService.supersede(id, dto);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.memoryService.restore(id);
  }

  @Post(':id/retire')
  retire(@Param('id') id: string, @Body() dto: RetireKnowledgeDto) {
    return this.memoryService.retire(id, dto);
  }
}
