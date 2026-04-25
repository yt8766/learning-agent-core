import { join } from 'node:path';

import {
  createIntelRepositories,
  executeDigestIntelRun,
  executePatrolIntelRun,
  loadIntelConfigSet,
  retryIntelDeliveries
} from '@agent/agents-intel-engine';

export type IntelScheduledJobName = 'intel-patrol' | 'intel-ingest' | 'intel-digest' | 'intel-delivery-retry';

interface IntelRunnerMcpClientManager {
  hasCapability(capabilityId: string): boolean;
  invokeTool: Parameters<typeof executePatrolIntelRun>[0]['mcpClientManager'] extends infer T
    ? T extends { invokeTool: infer InvokeTool }
      ? InvokeTool
      : never
    : never;
}

export interface RunIntelScheduledJobInput {
  jobName: IntelScheduledJobName;
  workspaceRoot: string;
  startedAt?: string;
  mcpClientManager?: IntelRunnerMcpClientManager;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export interface IntelScheduledJobRunResult {
  jobName: IntelScheduledJobName;
  status: 'completed' | 'skipped';
  summary: Record<string, number>;
}

function createRepositories(workspaceRoot: string) {
  return createIntelRepositories({
    databaseFile: join(workspaceRoot, 'data', 'intel', 'intel.db')
  });
}

function toRetryDeliveries(
  deliveries: ReturnType<ReturnType<typeof createIntelRepositories>['deliveries']['listPending']>
): Parameters<typeof retryIntelDeliveries>[0]['pendingDeliveries'] {
  return deliveries.map(delivery => ({
    id: delivery.id,
    signalId: delivery.signalId,
    channelType: 'lark',
    channelTarget: delivery.channelTarget,
    deliveryKind: delivery.deliveryKind === 'digest' ? 'digest' : 'alert',
    deliveryStatus: delivery.deliveryStatus === 'failed' ? 'failed' : 'pending',
    retryCount: delivery.retryCount,
    createdAt: delivery.createdAt,
    nextRetryAt: delivery.nextRetryAt ?? delivery.createdAt,
    expiresAt: delivery.expiresAt,
    lastAttemptAt: delivery.lastAttemptAt,
    failureReason: delivery.failureReason
  }));
}

export async function runIntelScheduledJob(input: RunIntelScheduledJobInput): Promise<IntelScheduledJobRunResult> {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const config = await loadIntelConfigSet(join(input.workspaceRoot, 'config', 'intel'));
  const repositories = createRepositories(input.workspaceRoot);

  if (input.jobName === 'intel-digest') {
    const result = await executeDigestIntelRun({
      jobId: input.jobName,
      startedAt,
      routes: config.routes,
      repositories: {
        signals: {
          listInWindow: ({ startAt, endAt }) =>
            repositories.signals.listByWindow({
              windowStart: startAt,
              windowEnd: endAt
            })
        },
        digests: {
          createDailyDigest: payload => repositories.dailyDigests.createDailyDigest(payload),
          linkSignals: (digestId, signalIds) => repositories.dailyDigests.linkSignals(digestId, signalIds)
        },
        deliveries: {
          insert: delivery =>
            repositories.deliveries.insert({
              ...delivery,
              updatedAt: delivery.createdAt
            })
        },
        signalSources: {
          listBySignalIds: signalIds => repositories.signalSources.listBySignalIds(signalIds)
        }
      }
    });

    return {
      jobName: input.jobName,
      status: 'completed',
      summary: {
        digests: result.persistedDigest ? 1 : 0,
        queuedDeliveries: result.queuedDeliveries.length
      }
    };
  }

  if (input.jobName === 'intel-delivery-retry') {
    const pendingDeliveries = toRetryDeliveries(repositories.deliveries.listPending());
    const result = await retryIntelDeliveries({
      jobId: input.jobName,
      startedAt,
      channels: config.channels,
      pendingDeliveries,
      env: input.env,
      fetchImpl: input.fetchImpl
    });

    for (const delivery of result.sentDeliveries) {
      repositories.deliveries.markSent({
        id: delivery.id,
        now: delivery.lastAttemptAt ?? startedAt
      });
    }

    for (const delivery of result.failedDeliveries) {
      repositories.deliveries.markFailed({
        id: delivery.id,
        now: delivery.lastAttemptAt ?? startedAt,
        failureReason: delivery.failureReason,
        nextRetryAt: delivery.nextRetryAt
      });
    }

    for (const delivery of result.closedDeliveries) {
      repositories.deliveries.markClosed({
        id: delivery.id,
        now: delivery.lastAttemptAt ?? startedAt,
        failureReason: delivery.failureReason
      });
    }

    return {
      jobName: input.jobName,
      status: 'completed',
      summary: {
        retryableDeliveries: result.retryableDeliveries.length,
        sentDeliveries: result.sentDeliveries.length,
        failedDeliveries: result.failedDeliveries.length,
        closedDeliveries: result.closedDeliveries.length
      }
    };
  }

  const result = await executePatrolIntelRun({
    mode: input.jobName === 'intel-ingest' ? 'ingest' : 'patrol',
    jobId: input.jobName,
    startedAt,
    sources: config.sources,
    routes: config.routes,
    repositories,
    mcpClientManager: input.mcpClientManager
  });

  return {
    jobName: input.jobName,
    status: 'completed',
    summary: {
      rawResults: result.rawResults.length,
      normalizedSignals: result.normalizedSignals.length,
      mergedSignals: result.mergedSignals.length,
      generatedAlerts: result.generatedAlerts.length,
      queuedDeliveries: result.queuedDeliveries.length
    }
  };
}
