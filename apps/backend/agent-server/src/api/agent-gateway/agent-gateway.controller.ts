import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  GatewayAccountingRequestSchema,
  GatewayListQuerySchema,
  GatewayPreprocessRequestSchema,
  GatewayProbeRequestSchema,
  GatewayTokenCountRequestSchema
} from '@agent/core';
import type {
  GatewayAccountingResponse,
  GatewayCredentialFile,
  GatewayLogListResponse,
  GatewayPreprocessResponse,
  GatewayProbeResponse,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewaySnapshot,
  GatewayTokenCountResponse,
  GatewayUsageListResponse
} from '@agent/core';
import { AgentGatewayAuthGuard } from '../../domains/agent-gateway/auth/agent-gateway-auth.guard';
import { AgentGatewayService } from '../../domains/agent-gateway/services/agent-gateway.service';
@Controller('agent-gateway')
@UseGuards(AgentGatewayAuthGuard)
export class AgentGatewayController {
  constructor(private readonly service: AgentGatewayService) {}
  @Get('snapshot') snapshot(): GatewaySnapshot {
    return this.service.snapshot();
  }
  @Get('providers') providers(): GatewayProviderCredentialSet[] {
    return this.service.listProviders();
  }
  @Get('credential-files') credentialFiles(): GatewayCredentialFile[] {
    return this.service.listCredentialFiles();
  }
  @Get('quotas') quotas(): GatewayQuota[] {
    return this.service.listQuotas();
  }
  @Get('logs') logs(@Query() query: unknown): GatewayLogListResponse {
    const parsed = GatewayListQuerySchema.safeParse(query);
    return this.service.listLogs(parsed.success ? parsed.data.limit : undefined);
  }
  @Get('usage') usage(@Query() query: unknown): GatewayUsageListResponse {
    const parsed = GatewayListQuerySchema.safeParse(query);
    return this.service.listUsage(parsed.success ? parsed.data.limit : undefined);
  }
  @Post('probe') probe(@Body() body: unknown): GatewayProbeResponse {
    const parsed = GatewayProbeRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '探测参数无效' });
    return this.service.probe(parsed.data);
  }
  @Post('token-count') tokenCount(@Body() body: unknown): GatewayTokenCountResponse {
    const parsed = GatewayTokenCountRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'token 计算参数无效' });
    return this.service.countTokens(parsed.data.text);
  }
  @Post('preprocess') preprocess(@Body() body: unknown): GatewayPreprocessResponse {
    const parsed = GatewayPreprocessRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '前处理参数无效' });
    return this.service.preprocess(parsed.data);
  }
  @Post('accounting') accounting(@Body() body: unknown): GatewayAccountingResponse {
    const parsed = GatewayAccountingRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '后处理参数无效' });
    return this.service.accounting(parsed.data);
  }
}
