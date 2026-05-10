import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type {
  GatewayOAuthCallbackResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartResponse,
  GatewayStartOAuthResponse
} from '@agent/core';
import antigravityIcon from '../assets/provider-icons/antigravity.svg';
import claudeIcon from '../assets/provider-icons/claude.svg';
import codexIcon from '../assets/provider-icons/codex.svg';
import kimiIcon from '../assets/provider-icons/kimi-light.svg';

const oauthProviders = [
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
    title: 'Claude OAuth 登录',
    hint: '发起 Claude OAuth 登录，完成后可在认证文件管理中查看凭据。',
    urlLabel: 'Claude 授权链接',
    icon: claudeIcon,
    button: '开始 Claude 登录'
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
    id: 'kimi',
    title: 'Kimi OAuth 登录',
    hint: '生成 Kimi 设备授权链接，完成授权后轮询认证文件状态。',
    urlLabel: 'Kimi 授权链接',
    icon: kimiIcon,
    button: '开始 Kimi 登录',
    supportsCallback: false
  }
];

type OAuthStartResult = GatewayStartOAuthResponse | GatewayProviderOAuthStartResponse;
type ProviderStatus = 'idle' | 'waiting' | 'success' | 'error';

interface ProviderState {
  callbackError?: string;
  callbackStatus?: 'success' | 'error';
  callbackSubmitting?: boolean;
  callbackUrl?: string;
  error?: string;
  state?: string;
  status?: ProviderStatus;
  url?: string;
  userCode?: string;
}

interface OAuthPolicyPageProps {
  onAddExcludedModel?: () => void;
  onCreateAlias?: () => void;
  onForkAlias?: () => void;
  onStartOAuth?: (providerId: string) => Promise<OAuthStartResult>;
  onStartCallbackPolling?: (providerId: string) => Promise<OAuthStartResult> | void;
  onRefreshStatus?: (state: string) => Promise<GatewayOAuthStatusResponse | undefined> | void;
  onSubmitCallback?: (providerId: string, redirectUrl: string) => Promise<GatewayOAuthCallbackResponse>;
}

export function OAuthPolicyPage({
  onAddExcludedModel,
  onCreateAlias,
  onForkAlias,
  onRefreshStatus,
  onStartOAuth,
  onSubmitCallback,
  onStartCallbackPolling
}: OAuthPolicyPageProps) {
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});

  const updateProviderState = (providerId: string, next: Partial<ProviderState>): void => {
    setProviderStates(current => ({
      ...current,
      [providerId]: { ...(current[providerId] ?? {}), ...next }
    }));
  };

  const handleStartOAuth = async (providerId: string): Promise<void> => {
    updateProviderState(providerId, {
      callbackError: undefined,
      callbackStatus: undefined,
      error: undefined,
      status: 'waiting',
      url: undefined,
      state: undefined,
      userCode: undefined
    });
    try {
      const result = await (onStartOAuth?.(providerId) ?? onStartCallbackPolling?.(providerId));
      if (!result) {
        updateProviderState(providerId, { status: 'idle' });
        return;
      }
      updateProviderState(providerId, {
        state: resolveOAuthState(result),
        status: 'waiting',
        url: result.verificationUri,
        userCode: 'userCode' in result ? result.userCode : undefined
      });
    } catch (error) {
      updateProviderState(providerId, { error: getErrorMessage(error), status: 'error' });
    }
  };

  const handleSubmitCallback = async (providerId: string): Promise<void> => {
    const redirectUrl = providerStates[providerId]?.callbackUrl?.trim();
    if (!redirectUrl) {
      updateProviderState(providerId, {
        callbackError: '请先贴上完整的回调 URL。',
        callbackStatus: 'error'
      });
      return;
    }
    updateProviderState(providerId, {
      callbackError: undefined,
      callbackStatus: undefined,
      callbackSubmitting: true
    });
    try {
      await onSubmitCallback?.(providerId, redirectUrl);
      updateProviderState(providerId, {
        callbackSubmitting: false,
        callbackStatus: 'success',
        status: 'waiting'
      });
    } catch (error) {
      updateProviderState(providerId, {
        callbackError: getErrorMessage(error),
        callbackStatus: 'error',
        callbackSubmitting: false
      });
    }
  };

  const handleRefreshStatus = async (providerId: string): Promise<void> => {
    const state = providerStates[providerId]?.state;
    if (!state) {
      updateProviderState(providerId, { error: '请先开始登录以获取 state。', status: 'error' });
      return;
    }
    try {
      const result = await onRefreshStatus?.(state);
      if (!result) return;
      updateProviderState(providerId, {
        error: result.status === 'error' ? '验证失败' : undefined,
        status: result.status === 'completed' ? 'success' : result.status === 'error' ? 'error' : 'waiting'
      });
    } catch (error) {
      updateProviderState(providerId, { error: getErrorMessage(error), status: 'error' });
    }
  };

  const handleRefreshFirstStatus = (): void => {
    const active = oauthProviders.find(provider => providerStates[provider.id]?.state);
    if (active) {
      void handleRefreshStatus(active.id);
      return;
    }
    onRefreshStatus?.('latest');
  };

  const handleCopyLink = async (url?: string): Promise<void> => {
    if (!url || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(url);
  };

  const handleOpenLink = (url?: string): void => {
    if (!url || typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="oauth-login-clone gateway-management-page" aria-label="OAuth 登录">
      <h1 className="management-page-title">OAuth 登录</h1>

      <div className="oauth-card-grid">
        {oauthProviders.map(provider => {
          const state = providerStates[provider.id] ?? {};
          return (
            <article className="oauth-login-card" key={provider.id}>
              <header className="oauth-card-header">
                <span className="oauth-card-title">
                  <img src={provider.icon} alt="" />
                  <span>{provider.title}</span>
                </span>
                <button type="button" onClick={() => void handleStartOAuth(provider.id)}>
                  {state.status === 'waiting' ? '等待验证中' : provider.button}
                </button>
              </header>
              <p>{provider.hint}</p>
              {state.url ? (
                <div className="oauth-url-box">
                  <span>{provider.urlLabel}</span>
                  <strong>{state.url}</strong>
                  {state.userCode ? <small>用户代码：{state.userCode}</small> : null}
                  <div>
                    <button type="button" onClick={() => void handleCopyLink(state.url)}>
                      <Copy size={15} aria-hidden="true" />
                      复制链接
                    </button>
                    <button type="button" onClick={() => handleOpenLink(state.url)}>
                      <ExternalLink size={15} aria-hidden="true" />
                      打开链接
                    </button>
                  </div>
                </div>
              ) : null}
              {state.url && provider.supportsCallback !== false ? (
                <label className="oauth-callback-field">
                  <span>Callback URL</span>
                  <input
                    onChange={event =>
                      updateProviderState(provider.id, {
                        callbackError: undefined,
                        callbackStatus: undefined,
                        callbackUrl: event.currentTarget.value
                      })
                    }
                    placeholder={buildCallbackPlaceholder(provider.id)}
                    value={state.callbackUrl ?? ''}
                  />
                </label>
              ) : null}
              {state.url ? (
                <div className="oauth-card-inline-actions">
                  {provider.supportsCallback !== false ? (
                    <button
                      disabled={state.callbackSubmitting}
                      type="button"
                      onClick={() => void handleSubmitCallback(provider.id)}
                    >
                      提交回调 URL
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void handleRefreshStatus(provider.id)}>
                    <RefreshCw size={15} aria-hidden="true" />
                    刷新状态
                  </button>
                </div>
              ) : null}
              {state.callbackStatus === 'success' ? (
                <div className="oauth-status-badge success">回调 URL 已提交，等待验证中...</div>
              ) : null}
              {state.callbackStatus === 'error' ? (
                <div className="oauth-status-badge error">回调 URL 提交失败：{state.callbackError}</div>
              ) : null}
              {state.status ? (
                <div className={`oauth-status-badge ${state.status}`}>{resolveStatusText(state)}</div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="oauth-policy-strip">
        <button type="button" onClick={onAddExcludedModel}>
          排除模型
        </button>
        <button type="button" onClick={onCreateAlias}>
          模型别名
        </button>
        <button type="button" onClick={onForkAlias}>
          Fork 别名
        </button>
        <button type="button" onClick={handleRefreshFirstStatus}>
          <RefreshCw size={15} aria-hidden="true" />
          状态轮询
        </button>
      </div>
    </section>
  );
}

function resolveOAuthState(result: OAuthStartResult): string | undefined {
  if ('state' in result) return result.state;
  return result.flowId;
}

function resolveStatusText(state: ProviderState): string {
  if (state.status === 'success') return '验证成功！';
  if (state.status === 'error') return `验证失败：${state.error ?? ''}`;
  if (state.status === 'waiting') return '等待验证中...';
  return '等待授权链接';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

function buildCallbackPlaceholder(providerId: string): string {
  const provider = providerId === 'claude' ? 'anthropic' : providerId;
  return `http://localhost:3000/api/agent-gateway/oauth/callback?provider=${provider}&code=...&state=...`;
}
