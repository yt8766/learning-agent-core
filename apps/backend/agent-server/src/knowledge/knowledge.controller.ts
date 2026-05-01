import { Body, Controller, Get, Post } from '@nestjs/common';

import { KnowledgeService, type KnowledgeLoginRequest, type KnowledgeRefreshRequest } from './knowledge.service';

@Controller('knowledge/v1/auth')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('login')
  login(@Body() body: KnowledgeLoginRequest) {
    return this.knowledgeService.login(body);
  }

  @Post('refresh')
  refresh(@Body() body: KnowledgeRefreshRequest) {
    return this.knowledgeService.refresh(body);
  }

  @Get('me')
  me() {
    return this.knowledgeService.me();
  }

  @Post('logout')
  logout() {
    return { ok: true };
  }
}
