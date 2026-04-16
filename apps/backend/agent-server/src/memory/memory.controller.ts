import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  InvalidateKnowledgeDto,
  MemoryFeedbackDto,
  OverrideMemoryDto,
  PatchUserProfileDto,
  ResolveResolutionCandidateDto,
  RetireKnowledgeDto,
  RollbackMemoryDto,
  SearchMemoryDto,
  SupersedeKnowledgeDto
} from '@agent/shared';

import { MemoryService } from './memory.service';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post('search')
  search(@Body() dto: SearchMemoryDto) {
    return this.memoryService.search(dto);
  }

  @Get('profiles/:userId')
  getProfile(@Param('userId') userId: string) {
    return this.memoryService.getProfile(userId);
  }

  @Post('profiles/:userId')
  patchProfile(@Param('userId') userId: string, @Body() dto: PatchUserProfileDto) {
    return this.memoryService.patchProfile(userId, dto);
  }

  @Get('resolution-candidates')
  listResolutionCandidates() {
    return this.memoryService.listResolutionCandidates();
  }

  @Get('insights/usage')
  usageInsights() {
    return this.memoryService.usageInsights();
  }

  @Post('resolution-candidates/:id/resolve')
  resolveResolutionCandidate(@Param('id') id: string, @Body() dto: ResolveResolutionCandidateDto) {
    return this.memoryService.resolveResolutionCandidate(id, dto);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.memoryService.history(id);
  }

  @Get(':id/compare/:leftVersion/:rightVersion')
  compare(
    @Param('id') id: string,
    @Param('leftVersion') leftVersion: string,
    @Param('rightVersion') rightVersion: string
  ) {
    return this.memoryService.compare(id, Number(leftVersion), Number(rightVersion));
  }

  @Get(':id/evidence-links')
  evidenceLinks(@Param('id') id: string) {
    return this.memoryService.evidenceLinks(id);
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

  @Post(':id/override')
  override(@Param('id') id: string, @Body() dto: OverrideMemoryDto) {
    return this.memoryService.override(id, dto);
  }

  @Post(':id/rollback')
  rollback(@Param('id') id: string, @Body() dto: RollbackMemoryDto) {
    return this.memoryService.rollback(id, dto);
  }

  @Post(':id/feedback')
  feedback(@Param('id') id: string, @Body() dto: MemoryFeedbackDto) {
    return this.memoryService.feedback(id, dto);
  }
}
