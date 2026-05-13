import { BadRequestException, Controller, Get, Header, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AgentGatewayOAuthService } from '../../domains/agent-gateway/oauth/agent-gateway-oauth.service';

@Controller('agent-gateway/oauth/callback')
export class AgentGatewayOAuthCallbackController {
  constructor(private readonly oauthService: AgentGatewayOAuthService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async handleCallback(@Query() query: Record<string, unknown>, @Req() request: Request): Promise<string> {
    const provider = stringValue(query.provider);
    const state = stringValue(query.state);
    if (!provider) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'OAuth callback 缺少 provider' });
    }
    if (!state) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'OAuth callback 缺少 state' });
    }

    await submitOAuthCallback(this.oauthService, {
      providerId: provider,
      provider,
      state,
      code: stringValue(query.code),
      error: stringValue(query.error),
      redirectUrl: buildOriginalUrl(request)
    });

    return buildCallbackReturnPage({
      provider,
      state,
      status: stringValue(query.error) ? 'error' : 'submitted',
      frontendUrl: buildFrontendOAuthUrl(request, provider, state, stringValue(query.error))
    });
  }
}

interface OAuthCallbackDelegate {
  completeCallback?: (request: {
    providerId: string;
    state: string;
    code?: string;
    error?: string;
    redirectUrl: string;
  }) => Promise<unknown>;
  submitCallback?: (request: { provider: string; redirectUrl: string }) => Promise<unknown>;
}

async function submitOAuthCallback(
  delegate: OAuthCallbackDelegate,
  request: {
    providerId: string;
    provider: string;
    state: string;
    code?: string;
    error?: string;
    redirectUrl: string;
  }
): Promise<void> {
  if (delegate.completeCallback) {
    await delegate.completeCallback(request);
    return;
  }
  if (delegate.submitCallback) {
    await delegate.submitCallback({ provider: request.provider, redirectUrl: request.redirectUrl });
    return;
  }
  throw new BadRequestException({ code: 'OAUTH_UNAVAILABLE', message: 'OAuth 服务未配置' });
}

function buildOriginalUrl(request: Request): string {
  const protocol = request.protocol || 'http';
  const host = request.get('host');
  return `${protocol}://${host}${request.originalUrl}`;
}

function buildFrontendOAuthUrl(request: Request, provider: string, state: string, error?: string): string {
  const configuredBase = process.env.AGENT_GATEWAY_FRONTEND_BASE_URL?.trim();
  const origin = configuredBase?.replace(/\/+$/, '') || `${request.protocol || 'http'}://${request.get('host')}`;
  const url = new URL('/oauth', origin);
  url.searchParams.set('oauthProvider', provider);
  url.searchParams.set('oauthState', state);
  url.searchParams.set('oauthStatus', error ? 'error' : 'submitted');
  if (error) url.searchParams.set('oauthError', error);
  return url.toString();
}

function buildCallbackReturnPage(input: {
  provider: string;
  state: string;
  status: 'submitted' | 'error';
  frontendUrl: string;
}): string {
  const payload = escapeJsonForHtml(
    JSON.stringify({
      provider: input.provider,
      state: input.state,
      status: input.status,
      receivedAt: new Date().toISOString()
    })
  );
  const frontendUrl = escapeHtml(input.frontendUrl);
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url=${frontendUrl}" />
    <title>OAuth 登录已提交</title>
  </head>
  <body>
    <script>
      try {
        localStorage.setItem('agent-gateway.oauth-callback', ${payload});
      } catch (_) {}
      window.location.replace(${JSON.stringify(input.frontendUrl)});
    </script>
    <p>OAuth 登录已提交，正在返回 Agent Gateway 管理页面。</p>
    <p><a href="${frontendUrl}">如果页面没有自动跳转，请点击这里返回。</a></p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeJsonForHtml(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
