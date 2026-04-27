import { Body, Controller, Get, Inject, NotImplementedException, Param, Post, Query } from '@nestjs/common';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import type { RuntimeWorkspaceDraftListQuery } from '../runtime/centers/runtime-centers-workspace-drafts';

type WorkspaceSkillDraftDecisionDto = Record<string, unknown>;

type WorkspaceCenterRuntimeService = {
  getWorkspaceCenter?: () => unknown;
  listWorkspaceSkillDrafts?: (query?: RuntimeWorkspaceDraftListQuery) => unknown;
  approveWorkspaceSkillDraft?: (draftId: string, dto: WorkspaceSkillDraftDecisionDto) => unknown;
  rejectWorkspaceSkillDraft?: (draftId: string, dto: WorkspaceSkillDraftDecisionDto) => unknown;
};

function requireWorkspaceCenterMethod<T extends keyof WorkspaceCenterRuntimeService>(
  runtimeCentersService: WorkspaceCenterRuntimeService,
  methodName: T
): NonNullable<WorkspaceCenterRuntimeService[T]> {
  const method = runtimeCentersService[methodName];

  if (!method) {
    throw new NotImplementedException(`RuntimeCentersService.${methodName} is not implemented`);
  }

  return method;
}

@Controller('platform')
export class WorkspaceCenterController {
  constructor(
    @Inject(RuntimeCentersService)
    private readonly runtimeCentersService: WorkspaceCenterRuntimeService
  ) {}

  @Get('workspace-center')
  getWorkspaceCenter() {
    return requireWorkspaceCenterMethod(this.runtimeCentersService, 'getWorkspaceCenter')();
  }

  @Get('workspace-center/skill-drafts')
  listWorkspaceSkillDrafts(@Query() query?: RuntimeWorkspaceDraftListQuery) {
    return requireWorkspaceCenterMethod(this.runtimeCentersService, 'listWorkspaceSkillDrafts')(query);
  }

  @Post('workspace-center/skill-drafts/:draftId/approve')
  approveWorkspaceSkillDraft(@Param('draftId') draftId: string, @Body() dto: WorkspaceSkillDraftDecisionDto) {
    return requireWorkspaceCenterMethod(this.runtimeCentersService, 'approveWorkspaceSkillDraft')(draftId, dto);
  }

  @Post('workspace-center/skill-drafts/:draftId/reject')
  rejectWorkspaceSkillDraft(@Param('draftId') draftId: string, @Body() dto: WorkspaceSkillDraftDecisionDto) {
    return requireWorkspaceCenterMethod(this.runtimeCentersService, 'rejectWorkspaceSkillDraft')(draftId, dto);
  }
}
