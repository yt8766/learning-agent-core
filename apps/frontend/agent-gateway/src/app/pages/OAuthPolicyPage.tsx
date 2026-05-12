import { CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  GatewayOAuthCallbackResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartProvider
} from '@agent/core';
import {
  buildCallbackPlaceholder,
  formatOAuthSuccessMessage,
  getErrorMessage,
  isCallbackSupported,
  mapStatusProjection,
  OAUTH_POLLING_INTERVAL_MS,
  OAUTH_SUCCESS_RESET_DELAY_MS,
  oauthProviders,
  resolveOAuthState,
  resolveStatusText,
  type OAuthStartResult,
  type ProviderState,
  type StartOAuthOptions
} from './oauth-policy-page.model';
import {
  openOAuthLoginWindow,
  refreshFirstOAuthStatus,
  startOAuthProviderLogin,
  submitOAuthCallbackUrl
} from './oauth-policy-page-operations';

export { buildCallbackPlaceholder } from './oauth-policy-page.model';
export {
  navigateOAuthLoginWindow,
  openOAuthLoginWindow,
  refreshFirstOAuthStatus,
  startOAuthProviderLogin,
  submitOAuthCallbackUrl
} from './oauth-policy-page-operations';

interface OAuthPolicyPageProps {
  onAddExcludedModel?: () => void;
  onCreateAlias?: () => void;
  onForkAlias?: () => void;
  providerStatuses?: Record<string, GatewayOAuthStatusResponse>;
  onStartOAuth?: (
    providerId: GatewayProviderOAuthStartProvider,
    options?: StartOAuthOptions
  ) => Promise<OAuthStartResult>;
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
  onStartCallbackPolling,
  providerStatuses = {}
}: OAuthPolicyPageProps) {
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const pollingTimers = useRef<Record<string, number>>({});
  const successResetTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(pollingTimers.current).forEach(timer => {
        if (timer) {
          window.clearInterval(timer);
        }
      });
      Object.values(successResetTimers.current).forEach(timer => {
        if (timer) {
          window.clearTimeout(timer);
        }
      });
      pollingTimers.current = {};
      successResetTimers.current = {};
    };
  }, []);

  const updateProviderState = (providerId: string, next: Partial<ProviderState>): void => {
    setProviderStates(current => ({
      ...current,
      [providerId]: {
        ...(current[providerId] ?? {}),
        ...next
      }
    }));
  };

  const clearPollingTimer = (providerId: string): void => {
    const timer = pollingTimers.current[providerId];
    if (timer !== undefined) {
      window.clearInterval(timer);
      delete pollingTimers.current[providerId];
    }
  };

  const clearSuccessResetTimer = (providerId: string): void => {
    const timer = successResetTimers.current[providerId];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete successResetTimers.current[providerId];
    }
  };

  const clearProviderTimers = (providerId: string): void => {
    clearPollingTimer(providerId);
    clearSuccessResetTimer(providerId);
  };

  const scheduleSuccessReset = (providerId: string): void => {
    clearSuccessResetTimer(providerId);
    successResetTimers.current[providerId] = window.setTimeout(() => {
      setProviderStates(current => {
        const old = current[providerId] ?? {};
        const next: ProviderState = {
          ...old,
          status: 'idle',
          error: undefined,
          state: undefined,
          url: undefined,
          userCode: undefined,
          callbackStatus: undefined,
          callbackError: undefined,
          callbackUrl: '',
          callbackSubmitting: false,
          polling: false,
          completedAt: undefined
        };
        return {
          ...current,
          [providerId]: next
        };
      });
      delete successResetTimers.current[providerId];
    }, OAUTH_SUCCESS_RESET_DELAY_MS);
  };

  const applyStatusProjection = (providerId: string, status: GatewayOAuthStatusResponse): void => {
    const projected = mapStatusProjection(status);

    if (status.status === 'completed') {
      clearProviderTimers(providerId);
      updateProviderState(providerId, {
        ...projected,
        completedAt: status.checkedAt,
        polling: false
      });
      scheduleSuccessReset(providerId);
      return;
    }

    if (status.status === 'error' || status.status === 'expired') {
      clearProviderTimers(providerId);
      updateProviderState(providerId, {
        ...projected,
        polling: false
      });
      return;
    }

    updateProviderState(providerId, {
      ...projected,
      polling: true
    });
  };

  const readProviderState = (providerId: string): string | undefined => {
    return providerStates[providerId]?.state ?? providerStatuses[providerId]?.state;
  };

  const startRefreshNow = async (providerId: string, state: string): Promise<void> => {
    if (!onRefreshStatus) {
      updateProviderState(providerId, {
        error: 'OAuth 状态刷新回调未接入。',
        status: 'error',
        polling: false
      });
      return;
    }

    try {
      const status = await onRefreshStatus(state);
      if (status) {
        applyStatusProjection(providerId, status);
      }
    } catch (error) {
      clearProviderTimers(providerId);
      updateProviderState(providerId, {
        error: getErrorMessage(error) || '状态刷新失败。',
        status: 'error',
        polling: false
      });
    }
  };

  const startPolling = async (providerId: string, state: string): Promise<void> => {
    if (!onRefreshStatus) {
      updateProviderState(providerId, {
        error: 'OAuth 状态刷新回调未接入。',
        status: 'error',
        polling: false
      });
      return;
    }

    clearPollingTimer(providerId);
    clearSuccessResetTimer(providerId);
    updateProviderState(providerId, {
      polling: true,
      status: 'waiting',
      callbackStatus: undefined,
      callbackError: undefined
    });
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const status = await onRefreshStatus(state);
          if (!status) {
            return;
          }
          applyStatusProjection(providerId, status);
        } catch (error) {
          clearProviderTimers(providerId);
          updateProviderState(providerId, {
            error: getErrorMessage(error) || '状态刷新失败。',
            polling: false,
            status: 'error'
          });
        }
      })();
    }, OAUTH_POLLING_INTERVAL_MS);

    pollingTimers.current[providerId] = timer;
    void startRefreshNow(providerId, state);
  };

  const handleStartOAuth = async (providerId: string): Promise<void> => {
    const provider = oauthProviders.find(item => item.id === providerId);
    if (!provider) {
      return;
    }

    clearProviderTimers(providerId);
    const popup = openOAuthLoginWindow();
    const nextResult = await startOAuthProviderLogin({
      providerId,
      providerState: providerStates[providerId] ?? {},
      providerUsesProject: provider.projectInput,
      onStartCallbackPolling,
      onStartOAuth,
      popup,
      updateProviderState: next => updateProviderState(providerId, next)
    });

    const nextState = nextResult ? resolveOAuthState(nextResult) : providerStates[providerId]?.state;
    if (nextState) {
      await startPolling(providerId, nextState);
    }
  };

  const handleSubmitCallback = async (providerId: string): Promise<void> => {
    const provider = providerStates[providerId];
    const redirectUrl = provider?.callbackUrl?.trim();
    if (!redirectUrl) {
      updateProviderState(providerId, {
        callbackError: '请先贴上完整的回调 URL。',
        callbackStatus: 'error'
      });
      return;
    }

    await submitOAuthCallbackUrl({
      providerId,
      redirectUrl,
      onSubmitCallback,
      updateProviderState: next => updateProviderState(providerId, next)
    });

    const state = provider?.state;
    if (state) {
      await startPolling(providerId, state);
    }
  };

  const handleRefreshStatus = async (providerId: string): Promise<void> => {
    const state = readProviderState(providerId);
    if (!state) {
      updateProviderState(providerId, {
        error: '请先开始登录以获取 state。',
        status: 'error',
        polling: false
      });
      return;
    }

    await startRefreshNow(providerId, state);
  };

  const handleRefreshFirstStatus = (): void => {
    void refreshFirstOAuthStatus({
      providerStates,
      onRefreshStatus,
      refreshProviderStatus: handleRefreshStatus,
      updateProviderState
    });
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
      <header className="oauth-policy-headline">
        <h1 className="management-page-title">OAuth 登录</h1>
        <p className="oauth-policy-subtitle">
          启动授权后，前端将自动轮询登录状态，回调提交成功后自动重试聚焦可见反馈。
        </p>
      </header>

      <div className="oauth-card-grid">
        {oauthProviders.map(provider => {
          const mergedState = {
            ...mapStatusProjection(providerStatuses[provider.id]),
            ...(providerStates[provider.id] ?? {})
          };

          const badgeClass =
            mergedState.status === 'success' ? 'success' : mergedState.status === 'error' ? 'error' : 'idle';
          const supportsCallback = isCallbackSupported(provider.id);

          return (
            <article className="oauth-login-card" key={provider.id}>
              <header className="oauth-card-header">
                <span className="oauth-card-title">
                  <img src={provider.icon} alt="" />
                  <span>{provider.title}</span>
                </span>
                <button type="button" onClick={() => void handleStartOAuth(provider.id)}>
                  {mergedState.status === 'waiting' ? '等待验证中' : provider.button}
                </button>
              </header>

              <p>{provider.hint}</p>

              {provider.projectInput ? (
                <label className="oauth-project-field">
                  <span>Google Cloud 项目 ID (可选)</span>
                  <input
                    onChange={event =>
                      updateProviderState(provider.id, {
                        projectId: event.currentTarget.value
                      })
                    }
                    placeholder="留空将自动选择第一个可用项目，输入 ALL 可获取全部项目。"
                    value={mergedState.projectId ?? ''}
                  />
                  <small>可选填写项目 ID。如不填写，系统将自动选择您账号下的第一个可用项目。</small>
                </label>
              ) : null}

              {mergedState.url ? (
                <div className="oauth-url-box">
                  <span>{provider.urlLabel}</span>
                  <strong>{mergedState.url}</strong>
                  {mergedState.userCode ? <small>用户代码：{mergedState.userCode}</small> : null}
                  <div>
                    <button type="button" onClick={() => void handleCopyLink(mergedState.url)}>
                      <Copy size={15} aria-hidden="true" />
                      复制链接
                    </button>
                    <button type="button" onClick={() => handleOpenLink(mergedState.url)}>
                      <ExternalLink size={15} aria-hidden="true" />
                      打开链接
                    </button>
                  </div>
                </div>
              ) : null}

              {mergedState.url && supportsCallback ? (
                <label className="oauth-callback-field">
                  <span>回调 URL</span>
                  <input
                    onChange={event =>
                      updateProviderState(provider.id, {
                        callbackError: undefined,
                        callbackStatus: undefined,
                        callbackUrl: event.currentTarget.value
                      })
                    }
                    placeholder={buildCallbackPlaceholder(provider.id)}
                    value={mergedState.callbackUrl ?? ''}
                  />
                </label>
              ) : null}

              {mergedState.url ? (
                <div className="oauth-card-inline-actions">
                  {supportsCallback ? (
                    <button
                      disabled={mergedState.callbackSubmitting}
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

              {mergedState.callbackStatus === 'success' ? (
                <div className="oauth-status-badge waiting">{formatOAuthSuccessMessage(provider.title)}</div>
              ) : null}
              {mergedState.callbackStatus === 'error' ? (
                <div className="oauth-status-badge error">回调 URL 提交失败：{mergedState.callbackError}</div>
              ) : null}
              {mergedState.status ? (
                <div className={`oauth-status-badge ${badgeClass}`}>
                  {mergedState.polling ? (
                    <span className="oauth-status-live-dot" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : null}
                  <span>{resolveStatusText(mergedState)}</span>
                  {mergedState.status === 'success' ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
                </div>
              ) : null}
              {mergedState.completedAt ? (
                <small className="oauth-success-note">{formatOAuthSuccessMessage(`${provider.title}`)}</small>
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
