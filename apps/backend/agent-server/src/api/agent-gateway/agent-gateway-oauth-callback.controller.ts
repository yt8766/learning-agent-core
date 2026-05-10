import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AgentGatewayOAuthPolicyService } from '../../domains/agent-gateway/oauth/agent-gateway-oauth-policy.service';

@Controller('agent-gateway/oauth/callback')
export class AgentGatewayOAuthCallbackController {
  constructor(private readonly oauthPolicyService: AgentGatewayOAuthPolicyService) {}

  @Get()
  async handleCallback(@Query() query: Record<string, unknown>, @Req() request: Request): Promise<string> {
    const provider = stringValue(query.provider);
    if (!provider) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'OAuth callback 缺少 provider' });
    }

    await this.oauthPolicyService.submitCallback({
      provider,
      redirectUrl: buildOriginalUrl(request)
    });

    return 'OAuth 登录已提交，可以回到管理页面查看认证状态。';
  }
}

function buildOriginalUrl(request: Request): string {
  const protocol = request.protocol || 'http';
  const host = request.get('host');
  return `${protocol}://${host}${request.originalUrl}`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
