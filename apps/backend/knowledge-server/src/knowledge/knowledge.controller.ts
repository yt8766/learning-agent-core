import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  KnowledgeBaseCreateRequestSchema,
  KnowledgeBaseMemberCreateRequestSchema,
  type KnowledgeBase,
  type KnowledgeBaseMembersResponse,
  type KnowledgeBasesListResponse
} from '@agent/core';

import { KnowledgeService } from './knowledge.service';

const LOCAL_ACTOR = { userId: 'local-user' };

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('bases')
  listBases(): Promise<KnowledgeBasesListResponse> {
    return this.knowledge.listBases(LOCAL_ACTOR);
  }

  @Post('bases')
  createBase(@Body() body: unknown): Promise<KnowledgeBase> {
    return this.knowledge.createBase(LOCAL_ACTOR, KnowledgeBaseCreateRequestSchema.parse(body));
  }

  @Get('bases/:baseId/members')
  listMembers(@Param('baseId') baseId: string): Promise<KnowledgeBaseMembersResponse> {
    return this.knowledge.listMembers(LOCAL_ACTOR, baseId);
  }

  @Post('bases/:baseId/members')
  addMember(
    @Param('baseId') baseId: string,
    @Body() body: unknown
  ): Promise<KnowledgeBaseMembersResponse['members'][number]> {
    return this.knowledge.addMember(LOCAL_ACTOR, baseId, KnowledgeBaseMemberCreateRequestSchema.parse(body));
  }
}
