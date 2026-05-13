import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { GatewayMigrationApplyResponse, GatewayMigrationPreview } from '@agent/core';
import { AgentGatewayAuthGuard } from '../../domains/agent-gateway/auth/agent-gateway-auth.guard';
import {
  CliProxyImportService,
  GatewayMigrationApplyRequestSchema,
  GatewayMigrationPreviewRequestSchema
} from '../../domains/agent-gateway/migration/cli-proxy-import.service';

@Controller('agent-gateway/migration')
@UseGuards(AgentGatewayAuthGuard)
export class AgentGatewayMigrationController {
  constructor(private readonly importService: CliProxyImportService) {}

  @Post('preview')
  preview(@Body() body: unknown): Promise<GatewayMigrationPreview> {
    return this.importService.preview(parseBody(GatewayMigrationPreviewRequestSchema, body));
  }

  @Post('apply')
  apply(@Body() body: unknown): Promise<GatewayMigrationApplyResponse> {
    return this.importService.apply(parseBody(GatewayMigrationApplyRequestSchema, body));
  }
}

function parseBody<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } },
  body: unknown
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Agent Gateway migration 参数无效' });
  }
  return parsed.data;
}
