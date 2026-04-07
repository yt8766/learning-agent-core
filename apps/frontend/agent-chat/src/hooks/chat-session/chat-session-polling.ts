import type { ChatCheckpointRecord } from '@/types/chat';

export function shouldSkipStopSessionPolling(sessionId: string | undefined, pollingSessionId: string) {
  return Boolean(sessionId && pollingSessionId && pollingSessionId !== sessionId);
}

export interface SessionPollingRunnerOptions {
  mode: 'checkpoint' | 'detail';
  sessionId: string;
  checkpointRefreshInFlight: boolean;
  hydrateSessionSnapshot: (sessionId: string, forceRefresh: boolean) => Promise<{ status?: string } | undefined>;
  refreshCheckpointOnly: (sessionId: string) => Promise<ChatCheckpointRecord | undefined>;
  deriveSessionStatusFromCheckpoint: (checkpoint?: ChatCheckpointRecord) => string | undefined;
  stopSessionPolling: (sessionId: string) => void;
}

export function createSessionPollingRunner(options: SessionPollingRunnerOptions) {
  return () => {
    if (options.mode === 'detail') {
      void options.hydrateSessionSnapshot(options.sessionId, false).then(detail => {
        if (!detail) {
          return;
        }
        if (detail.status !== 'running') {
          options.stopSessionPolling(options.sessionId);
        }
      });
      return;
    }

    if (!options.checkpointRefreshInFlight) {
      void options.refreshCheckpointOnly(options.sessionId).then(nextCheckpoint => {
        const nextStatus = nextCheckpoint ? options.deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
        if (nextStatus && nextStatus !== 'running') {
          options.stopSessionPolling(options.sessionId);
        }
      });
    }
  };
}
