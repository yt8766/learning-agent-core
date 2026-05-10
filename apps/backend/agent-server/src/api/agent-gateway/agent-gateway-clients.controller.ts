import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  GatewayCreateClientApiKeyRequestSchema,
  GatewayCreateClientRequestSchema,
  GatewayUpdateClientApiKeyRequestSchema,
  GatewayUpdateClientQuotaRequestSchema,
  GatewayUpdateClientRequestSchema,
  type GatewayClient,
  type GatewayClientApiKey,
  type GatewayClientApiKeyListResponse,
  type GatewayClientListResponse,
  type GatewayClientQuota,
  type GatewayClientRequestLogListResponse,
  type GatewayClientUsageSummary,
  type GatewayCreateClientApiKeyResponse
} from '@agent/core';
import type { z } from 'zod';
import { AgentGatewayAuthGuard } from '../../domains/agent-gateway/auth/agent-gateway-auth.guard';
import { AgentGatewayClientApiKeyService } from '../../domains/agent-gateway/clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from '../../domains/agent-gateway/clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from '../../domains/agent-gateway/clients/agent-gateway-client.service';

@Controller('agent-gateway/clients')
@UseGuards(AgentGatewayAuthGuard)
export class AgentGatewayClientsController {
  constructor(
    private readonly clientService: AgentGatewayClientService,
    private readonly apiKeyService: AgentGatewayClientApiKeyService,
    private readonly quotaService: AgentGatewayClientQuotaService
  ) {}

  @Get()
  listClients(): Promise<GatewayClientListResponse> {
    return this.clientService.list();
  }

  @Post()
  createClient(@Body() body: unknown): Promise<GatewayClient> {
    return this.clientService.create(parseBody(GatewayCreateClientRequestSchema, body));
  }

  @Get(':clientId')
  getClient(@Param('clientId') clientId: string): Promise<GatewayClient> {
    return this.clientService.get(clientId);
  }

  @Patch(':clientId')
  updateClient(@Param('clientId') clientId: string, @Body() body: unknown): Promise<GatewayClient> {
    return this.clientService.update(clientId, parseBody(GatewayUpdateClientRequestSchema, body));
  }

  @Patch(':clientId/enable')
  enableClient(@Param('clientId') clientId: string): Promise<GatewayClient> {
    return this.clientService.enable(clientId);
  }

  @Patch(':clientId/disable')
  disableClient(@Param('clientId') clientId: string): Promise<GatewayClient> {
    return this.clientService.disable(clientId);
  }

  @Get(':clientId/api-keys')
  listApiKeys(@Param('clientId') clientId: string): Promise<GatewayClientApiKeyListResponse> {
    return this.apiKeyService.list(clientId);
  }

  @Post(':clientId/api-keys')
  createApiKey(@Param('clientId') clientId: string, @Body() body: unknown): Promise<GatewayCreateClientApiKeyResponse> {
    return this.apiKeyService.create(clientId, parseBody(GatewayCreateClientApiKeyRequestSchema, body));
  }

  @Patch(':clientId/api-keys/:apiKeyId')
  updateApiKey(
    @Param('clientId') clientId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Body() body: unknown
  ): Promise<GatewayClientApiKey> {
    return this.apiKeyService.update(clientId, apiKeyId, parseBody(GatewayUpdateClientApiKeyRequestSchema, body));
  }

  @Post(':clientId/api-keys/:apiKeyId/rotate')
  rotateApiKey(
    @Param('clientId') clientId: string,
    @Param('apiKeyId') apiKeyId: string
  ): Promise<GatewayCreateClientApiKeyResponse> {
    return this.apiKeyService.rotate(clientId, apiKeyId);
  }

  @Delete(':clientId/api-keys/:apiKeyId')
  revokeApiKey(@Param('clientId') clientId: string, @Param('apiKeyId') apiKeyId: string): Promise<GatewayClientApiKey> {
    return this.apiKeyService.revoke(clientId, apiKeyId);
  }

  @Get(':clientId/quota')
  quota(@Param('clientId') clientId: string): Promise<GatewayClientQuota> {
    return this.quotaService.getQuota(clientId);
  }

  @Put(':clientId/quota')
  updateQuota(@Param('clientId') clientId: string, @Body() body: unknown): Promise<GatewayClientQuota> {
    return this.quotaService.updateQuota(clientId, parseBody(GatewayUpdateClientQuotaRequestSchema, body));
  }

  @Get(':clientId/usage')
  usage(@Param('clientId') clientId: string): Promise<GatewayClientUsageSummary> {
    return this.quotaService.usage(clientId);
  }

  @Get(':clientId/logs')
  logs(
    @Param('clientId') clientId: string,
    @Query('limit') limit?: string
  ): Promise<GatewayClientRequestLogListResponse> {
    return this.quotaService.logs(clientId, parseLimit(limit));
  }
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', issues: parsed.error.issues });
  return parsed.data;
}

function parseLimit(limit: string | undefined): number | undefined {
  if (!limit) return undefined;
  const parsed = Number(limit);
  return Number.isFinite(parsed) ? parsed : undefined;
}
