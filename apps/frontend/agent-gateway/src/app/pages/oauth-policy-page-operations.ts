import type {
  GatewayOAuthCallbackResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartProvider
} from '@agent/core';
import {
  OAUTH_FALLBACK_PROVIDER_ID,
  getErrorMessage,
  mapOAuthStartProviderId,
  mapStatusProjection,
  oauthProviders,
  resolveOAuthState,
  type OAuthStartResult,
  type ProviderState,
  type StartOAuthOptions,
  type UpdateProviderState
} from './oauth-policy-page.model';

export async function startOAuthProviderLogin({
  providerId,
  providerState,
  providerUsesProject = false,
  onStartCallbackPolling,
  onStartOAuth,
  popup,
  updateProviderState
}: {
  providerId: string;
  providerState: ProviderState;
  providerUsesProject?: boolean;
  onStartCallbackPolling?: (providerId: string) => Promise<OAuthStartResult> | void;
  onStartOAuth?: (
    providerId: GatewayProviderOAuthStartProvider,
    options?: StartOAuthOptions
  ) => Promise<OAuthStartResult>;
  popup: Window | null;
  updateProviderState: UpdateProviderState;
}): Promise<OAuthStartResult | undefined> {
  const projectId = providerState.projectId?.trim();
  updateProviderState({
    callbackError: undefined,
    callbackStatus: undefined,
    error: undefined,
    status: 'waiting',
    url: undefined,
    state: undefined,
    userCode: undefined
  });
  try {
    const result = await resolveOAuthStartResult({
      providerId,
      providerUsesProject,
      projectId,
      onStartCallbackPolling,
      onStartOAuth
    });
    if (!result) return undefined;
    navigateOAuthLoginWindow(popup, result.verificationUri);
    updateProviderState({
      state: resolveOAuthState(result),
      status: 'waiting',
      url: result.verificationUri,
      userCode: 'userCode' in result ? result.userCode : undefined
    });
    return result;
  } catch (error) {
    closeOAuthLoginWindow(popup);
    updateProviderState({ error: getErrorMessage(error), status: 'error' });
    return undefined;
  }
}

export async function submitOAuthCallbackUrl({
  providerId,
  redirectUrl,
  onSubmitCallback,
  updateProviderState
}: {
  providerId: string;
  redirectUrl: string;
  onSubmitCallback?: (providerId: string, redirectUrl: string) => Promise<GatewayOAuthCallbackResponse>;
  updateProviderState: UpdateProviderState;
}): Promise<void> {
  updateProviderState({
    callbackError: undefined,
    callbackStatus: undefined,
    callbackSubmitting: true
  });
  try {
    if (!onSubmitCallback) {
      throw new Error('OAuth callback submit handler is not wired.');
    }
    await onSubmitCallback(providerId, redirectUrl);
    updateProviderState({
      callbackSubmitting: false,
      callbackStatus: 'success',
      status: 'waiting'
    });
  } catch (error) {
    updateProviderState({
      callbackError: getErrorMessage(error),
      callbackStatus: 'error',
      callbackSubmitting: false
    });
  }
}

export async function refreshFirstOAuthStatus({
  fallbackProviderId = OAUTH_FALLBACK_PROVIDER_ID,
  onRefreshStatus,
  providerStates,
  refreshProviderStatus,
  updateProviderState
}: {
  fallbackProviderId?: string;
  onRefreshStatus?: (state: string) => Promise<GatewayOAuthStatusResponse | undefined> | void;
  providerStates: Record<string, ProviderState>;
  refreshProviderStatus: (providerId: string) => Promise<void> | void;
  updateProviderState: (providerId: string, next: Partial<ProviderState>) => void;
}): Promise<void> {
  const active = oauthProviders.find(provider => providerStates[provider.id]?.state);
  if (active) {
    await refreshProviderStatus(active.id);
    return;
  }
  try {
    if (!onRefreshStatus) {
      throw new Error('OAuth status refresh handler is not wired.');
    }
    const result = await onRefreshStatus('latest');
    if (result) {
      updateProviderState(fallbackProviderId, mapStatusProjection(result));
    }
  } catch (error) {
    updateProviderState(fallbackProviderId, { error: getErrorMessage(error), status: 'error' });
  }
}

export function openOAuthLoginWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  return window.open('about:blank', '_blank', 'popup=yes,width=1080,height=820');
}

export function navigateOAuthLoginWindow(popup: Window | null, url: string): void {
  if (!url || typeof window === 'undefined') return;
  if (popup && !popup.closed) {
    popup.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function resolveOAuthStartResult({
  providerId,
  providerUsesProject,
  projectId,
  onStartCallbackPolling,
  onStartOAuth
}: {
  providerId: string;
  providerUsesProject: boolean;
  projectId?: string;
  onStartCallbackPolling?: (providerId: string) => Promise<OAuthStartResult> | void;
  onStartOAuth?: (
    providerId: GatewayProviderOAuthStartProvider,
    options?: StartOAuthOptions
  ) => Promise<OAuthStartResult>;
}): Promise<OAuthStartResult> {
  const result =
    (await onStartOAuth?.(
      mapOAuthStartProviderId(providerId),
      providerUsesProject && projectId ? { projectId } : undefined
    )) ?? (await onStartCallbackPolling?.(providerId));
  if (!result) {
    throw new Error('OAuth start callback is not wired.');
  }
  return result;
}

function closeOAuthLoginWindow(popup: Window | null): void {
  if (popup && !popup.closed) popup.close();
}
