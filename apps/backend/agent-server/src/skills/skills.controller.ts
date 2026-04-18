import { Controller, Get, Param, Post, Query } from '@nestjs/common';

import { SkillStatus, SkillStatusValues } from '@agent/core';

import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get('lab')
  listLab() {
    return this.skillsService.listLab();
  }

  @Get()
  list(@Query('status') status?: SkillStatus) {
    const normalized = status && SkillStatusValues.includes(status) ? status : undefined;
    return this.skillsService.list(normalized);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.skillsService.getById(id);
  }

  @Post(':id/promote')
  promote(@Param('id') id: string) {
    return this.skillsService.promote(id);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string) {
    return this.skillsService.disable(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.skillsService.restore(id);
  }

  @Post(':id/retire')
  retire(@Param('id') id: string) {
    return this.skillsService.retire(id);
  }
}
