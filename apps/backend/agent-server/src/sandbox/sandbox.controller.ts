import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { SandboxService } from './sandbox.service';

@Controller('sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Get('profiles')
  listProfiles() {
    return this.sandboxService.listProfiles();
  }

  @Post('preflight')
  preflight(@Body() body: unknown) {
    return this.sandboxService.preflight(body);
  }

  @Post('execute')
  executeCommand(@Body() body: unknown) {
    return this.sandboxService.executeCommand(body);
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string) {
    return this.sandboxService.getRun(runId);
  }

  @Post('runs/:runId/cancel')
  cancelRun(@Param('runId') runId: string, @Body() body: unknown) {
    return this.sandboxService.cancelRun(runId, body);
  }

  @Post('runs/:runId/approval')
  resumeApproval(@Param('runId') runId: string, @Body() body: unknown) {
    return this.sandboxService.resumeApproval(runId, body);
  }
}
