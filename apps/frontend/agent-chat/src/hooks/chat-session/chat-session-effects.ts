export interface SessionActivationPlanInput {
  activeSessionId: string;
  pendingInitialSessionId?: string;
  streamReconnectSessionId?: string;
}

export interface SessionActivationPlan {
  shouldSelectSession: boolean;
  shouldRefreshDetail: boolean;
  shouldOpenStreamImmediately: boolean;
}

export interface StreamFallbackDecisionInput {
  isDisposed: boolean;
  detailStatus?: string;
  hasAssistantContent?: boolean;
}

export const STREAM_IDLE_TIMEOUT_MS = 45_000;

export function buildSessionActivationPlan(input: SessionActivationPlanInput): SessionActivationPlan {
  if (!input.activeSessionId) {
    return {
      shouldSelectSession: false,
      shouldRefreshDetail: false,
      shouldOpenStreamImmediately: false
    };
  }

  const hasPendingInitialMessage = input.pendingInitialSessionId === input.activeSessionId;
  const hasStreamReconnectRequest = input.streamReconnectSessionId === input.activeSessionId;

  if (hasPendingInitialMessage || hasStreamReconnectRequest) {
    return {
      shouldSelectSession: false,
      shouldRefreshDetail: false,
      shouldOpenStreamImmediately: true
    };
  }

  return {
    shouldSelectSession: true,
    shouldRefreshDetail: true,
    shouldOpenStreamImmediately: false
  };
}

export function shouldStartDetailPollingAfterStreamError(input: StreamFallbackDecisionInput) {
  if (input.isDisposed) {
    return false;
  }

  return input.detailStatus === 'running';
}

export function shouldShowStreamFallbackError(input: StreamFallbackDecisionInput) {
  if (input.isDisposed) {
    return false;
  }

  return input.detailStatus === 'running' && !input.hasAssistantContent;
}

export function shouldStartDetailPollingAfterIdleClose(detailStatus?: string) {
  return detailStatus === 'running';
}
