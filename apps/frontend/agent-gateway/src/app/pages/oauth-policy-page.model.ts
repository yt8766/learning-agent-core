import type {
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartProvider,
  GatewayProviderOAuthStartResponse,
  GatewayStartOAuthResponse
} from '@agent/core';
import antigravityIcon from '../assets/provider-icons/antigravity.svg';
import claudeIcon from '../assets/provider-icons/claude.svg';
import codexIcon from '../assets/provider-icons/codex.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import kimiIcon from '../assets/provider-icons/kimi-light.svg';

export const OAUTH_FALLBACK_PROVIDER_ID = 'codex';

export const OAUTH_POLLING_INTERVAL_MS = 3000;
export const OAUTH_SUCCESS_RESET_DELAY_MS = 5000;
export const OAUTH_SUCCESS_MESSAGE = '授权完成，已接入认证文件，5秒后恢复可重试。';

export interface ProviderDefinition {
  id: string;
  title: string;
  hint: string;
  urlLabel: string;
  icon: string;
  button: string;
  projectInput?: boolean;
  supportsCallback?: boolean;
}

export const oauthProviders: ProviderDefinition[] = [
  {
    id: 'codex',
    title: 'Codex OAuth 登录',
    hint: '使用 Codex 网页授权流生成认证文件，支持 callback URL 回填。',
    urlLabel: 'Codex 授权链接',
    icon: codexIcon,
    button: '开始 Codex 登录'
  },
  {
    id: 'claude',
    title: 'Anthropic OAuth 登录',
    hint: '通过 OAuth 流程登录 Anthropic (Claude) 服务，自动获取并保存认证文件。',
    urlLabel: 'Anthropic 授权链接',
    icon: claudeIcon,
    button: '开始 Anthropic 登录'
  },
  {
    id: 'antigravity',
    title: 'Antigravity OAuth 登录',
    hint: '生成 Antigravity 授权链接，并轮询登录状态直到认证文件落盘。',
    urlLabel: 'Antigravity 授权链接',
    icon: antigravityIcon,
    button: '开始 Antigravity 登录'
  },
  {
    id: 'gemini-cli',
    title: 'Gemini CLI OAuth 登录',
    hint: '通过 OAuth 流程登录 Google Gemini CLI 服务，自动获取并保存认证文件。',
    urlLabel: 'Gemini CLI 授权链接',
    icon: geminiIcon,
    button: '开始 Gemini CLI 登录',
    projectInput: true
  },
  {
    id: 'kimi',
    title: 'Kimi OAuth 登录',
    hint: '生成 Kimi 设备授权链接，完成授权后轮询认证文件状态。',
    urlLabel: 'Kimi 授权链接',
    icon: kimiIcon,
    button: '开始 Kimi 登录',
    supportsCallback: false
  }
];

export type OAuthStartResult = GatewayStartOAuthResponse | GatewayProviderOAuthStartResponse;
export type ProviderStatus = 'idle' | 'waiting' | 'success' | 'error';

export interface ProviderState {
  completedAt?: string;
  callbackError?: string;
  callbackStatus?: 'success' | 'error';
  callbackSubmitting?: boolean;
  callbackUrl?: string;
  error?: string;
  projectId?: string;
  state?: string;
  status?: ProviderStatus;
  polling?: boolean;
  url?: string;
  userCode?: string;
}

export interface StartOAuthOptions {
  projectId?: string;
}

export type UpdateProviderState = (next: Partial<ProviderState>) => void;

export function resolveOAuthState(result: OAuthStartResult): string | undefined {
  if ('state' in result) return result.state;
  return result.flowId;
}

export function mapOAuthStartProviderId(providerId: string): GatewayProviderOAuthStartProvider {
  if (providerId === 'claude') return 'anthropic';
  if (providerId === 'codex' || providerId === 'antigravity' || providerId === 'gemini-cli' || providerId === 'kimi') {
    return providerId;
  }
  return 'codex';
}

export function resolveStatusText(state: ProviderState): string {
  if (state.status === 'success') return '验证成功！';
  if (state.status === 'error') return `验证失败：${state.error ?? ''}`;
  if (state.status === 'waiting') return '等待验证中...';
  return '等待授权链接';
}

export function mapStatusProjection(status: GatewayOAuthStatusResponse | undefined): ProviderState {
  if (!status) return {};
  if (status.status === 'completed') {
    return { state: status.state, status: 'success' };
  }
  if (status.status === 'error' || status.status === 'expired') {
    return { error: status.status === 'expired' ? '授权已过期' : '验证失败', state: status.state, status: 'error' };
  }
  return { state: status.state, status: 'waiting' };
}

export function isCallbackSupported(providerId: string): boolean {
  const provider = oauthProviders.find(item => item.id === providerId);
  return provider?.supportsCallback !== false;
}

export function formatOAuthSuccessMessage(providerTitle: string): string {
  return `${providerTitle} ${OAUTH_SUCCESS_MESSAGE}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

export function buildCallbackPlaceholder(providerId: string): string {
  if (providerId === 'claude') return 'http://localhost:54545/callback?code=...&state=...';
  if (providerId === 'antigravity') return 'http://localhost:51121/oauth-callback?code=...&state=...';
  if (providerId === 'gemini-cli') return 'http://localhost:8085/oauth2callback?code=...&state=...';
  return 'http://localhost:1455/auth/callback?code=...&state=...';
}
