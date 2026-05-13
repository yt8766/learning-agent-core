import type {
  GatewayAuthFilePatchRequest,
  GatewayGeminiCliOAuthStartRequest,
  GatewayProviderOAuthStartRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from '@agent/core';
import type { GatewayStartOAuthProjection } from './agent-gateway-management-client';
import { now, stringField, type RecordBody } from './cli-proxy-management-client.helpers';
import { buildProviderNativeOAuthAuthorizationUri } from '../runtime-engine/oauth/provider-native-oauth-url';

export function toCliProxyAuthFilePatchBody(request: GatewayAuthFilePatchRequest): Record<string, unknown> {
  return {
    name: request.authFileId,
    headers: request.headers,
    note: request.note === undefined ? undefined : (request.note ?? ''),
    prefix: request.prefix === undefined ? undefined : (request.prefix ?? ''),
    priority: request.priority,
    proxy_url: request.proxyUrl === undefined ? undefined : (request.proxyUrl ?? '')
  };
}

export function hasCliProxyAuthFileFieldsPatch(request: GatewayAuthFilePatchRequest): boolean {
  return (
    request.headers !== undefined ||
    request.note !== undefined ||
    request.prefix !== undefined ||
    request.priority !== undefined ||
    request.proxyUrl !== undefined
  );
}

export function normalizeProviderAuthorizationUri(provider: string, state: string, upstreamUri: string): string {
  if (!isAgentGatewayCallbackPlaceholder(upstreamUri)) return upstreamUri;
  return buildProviderNativeOAuthAuthorizationUri({ provider: toNativeOAuthProvider(provider), state });
}

export function providerOAuthRequestPath(request: GatewayProviderOAuthStartRequest): string {
  const params = new URLSearchParams();
  if (request.isWebui) params.set('is_webui', 'true');
  if (request.projectId) params.set('project_id', request.projectId);
  const query = params.toString();
  return `/${request.provider}-auth-url${query ? `?${query}` : ''}`;
}

export function projectProviderOAuthStart(
  request: GatewayProviderOAuthStartRequest,
  body: RecordBody
): GatewayStartOAuthProjection {
  const state = stringField(body, 'state') ?? `${request.provider}-oauth`;
  const upstreamUri =
    stringField(body, 'url', 'authUrl', 'verificationUri', 'verification_uri', 'deviceUrl', 'device_url') ?? '';
  return {
    state,
    verificationUri: normalizeProviderAuthorizationUri(request.provider, state, upstreamUri),
    userCode: stringField(body, 'userCode', 'user_code'),
    expiresAt: now(),
    projectId: request.projectId
  };
}

export function geminiCliOAuthRequestPath(request: GatewayGeminiCliOAuthStartRequest): string {
  return `/gemini-cli-auth-url?is_webui=true&project_id=${request.projectId ?? 'default'}`;
}

export function projectGeminiCliOAuthStart(
  request: GatewayGeminiCliOAuthStartRequest,
  body: RecordBody
): GatewayStartOAuthProjection {
  const projectId = request.projectId ?? 'default';
  return {
    state: stringField(body, 'state') ?? `gemini-cli-${projectId}`,
    verificationUri: stringField(body, 'url', 'authUrl') ?? '',
    userCode: stringField(body, 'userCode'),
    expiresAt: now(),
    projectId
  };
}

export function projectVertexCredentialImport(
  request: GatewayVertexCredentialImportRequest,
  body: RecordBody
): GatewayVertexCredentialImportResponse {
  return {
    status: 'ok',
    imported: true,
    projectId: stringField(body, 'projectId'),
    location: request.location,
    authFile: request.fileName,
    authFileId: request.fileName
  };
}

function toNativeOAuthProvider(provider: string): string {
  return provider === 'anthropic' ? 'claude' : provider;
}

function isAgentGatewayCallbackPlaceholder(value: string): boolean {
  const candidates = collectUriCandidates(value);
  return candidates.some(candidate => {
    try {
      return new URL(candidate, 'http://localhost').pathname.replace(/\/$/, '') === '/api/agent-gateway/oauth/callback';
    } catch {
      return false;
    }
  });
}

function collectUriCandidates(value: string): string[] {
  const candidates = [value];
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) candidates.push(decoded);
  } catch {
    // ignore non-decodable values
  }
  return Array.from(new Set(candidates));
}
