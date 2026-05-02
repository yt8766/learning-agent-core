import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  KnowledgeBaseCreateRequestSchema,
  KnowledgeBaseMemberCreateRequestSchema,
  type KnowledgeBase,
  type KnowledgeBaseMembersResponse,
  type KnowledgeBasesListResponse
} from '@agent/core';

import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { KnowledgeAuthUser } from '../auth/auth-token-verifier';
import { KnowledgeService } from './knowledge.service';

@UseGuards(AuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('bases')
  listBases(@AuthUser() user: KnowledgeAuthUser): Promise<KnowledgeBasesListResponse> {
    return this.knowledge.listBases(user);
  }

  @Post('bases')
  createBase(@AuthUser() user: KnowledgeAuthUser, @Body() body: unknown): Promise<KnowledgeBase> {
    return this.knowledge.createBase(user, KnowledgeBaseCreateRequestSchema.parse(body));
  }

  @Get('bases/:baseId/members')
  listMembers(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('baseId') baseId: string
  ): Promise<KnowledgeBaseMembersResponse> {
    return this.knowledge.listMembers(user, baseId);
  }

  @Post('bases/:baseId/members')
  addMember(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('baseId') baseId: string,
    @Body() body: unknown
  ): Promise<KnowledgeBaseMembersResponse['members'][number]> {
    return this.knowledge.addMember(user, baseId, KnowledgeBaseMemberCreateRequestSchema.parse(body));
  }
}
