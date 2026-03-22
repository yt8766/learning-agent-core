import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { SearchMemoryDto } from '@agent/shared';

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
}
