import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type {
  IntelChannelsConfig,
  IntelRoutesConfig,
  IntelSourcesConfig
} from '../../flows/intel/schemas/intel-config.schema';
import type { IntelRetryDeliveryRecord } from '../../flows/intel/schemas/delivery-retry-graph-state.schema';
import { executeDigestIntelRun } from '../../runtime/execution/digest-intel-run';
import { executePatrolIntelRun } from '../../runtime/execution/patrol-intel-run';
import { retryIntelDeliveries } from '../../runtime/execution/retry-intel-deliveries';
import type { IntelRepositories } from '../../runtime/storage/intel.repositories';

interface IntelMcpClientManager {
  hasCapability(capabilityId: string): boolean;
  invokeTool(
    toolName: string,
    request: {
      taskId: string;
      toolName: string;
      intent: string;
      input: Record<string, unknown>;
      requestedBy: 'agent' | 'user';
    }
  ): Promise<{
    ok: boolean;
    rawOutput?: unknown;
    errorMessage?: string;
  }>;
}

export interface IntelGraphState {
  mode: 'patrol' | 'digest' | 'delivery_retry';
  jobId: string;
  startedAt: string;
  sources?: IntelSourcesConfig;
  routes: IntelRoutesConfig;
  channels?: IntelChannelsConfig;
  repositories: IntelRepositories;
  mcpClientManager?: IntelMcpClientManager;
  digestDate?: string;
  pendingDeliveries?: IntelRetryDeliveryRecord[];
  retryableDeliveries?: IntelRetryDeliveryRecord[];
  sentDeliveries?: IntelRetryDeliveryRecord[];
  failedDeliveries?: IntelRetryDeliveryRecord[];
  closedDeliveries?: IntelRetryDeliveryRecord[];
  persistedDigestIds?: string[];
  renderedDigests?: Array<Record<string, unknown>>;
  generatedAlerts?: Array<Record<string, unknown>>;
  queuedDeliveries?: Array<Record<string, unknown>>;
  normalizedSignals?: Array<Record<string, unknown>>;
  mergedSignals?: Array<Record<string, unknown>>;
  scoredSignals?: Array<Record<string, unknown>>;
  rawResults?: Array<Record<string, unknown>>;
  errors?: string[];
}

export interface IntelGraphHandlers {
  executePatrol?: (state: IntelGraphState) => Promise<Partial<IntelGraphState>>;
  executeDigest?: (state: IntelGraphState) => Promise<Partial<IntelGraphState>>;
  executeRetry?: (state: IntelGraphState) => Promise<Partial<IntelGraphState>>;
}

const IntelGraphAnnotation = Annotation.Root({
  mode: Annotation<IntelGraphState['mode']>(),
  jobId: Annotation<string>(),
  startedAt: Annotation<string>(),
  sources: Annotation<IntelSourcesConfig | undefined>(),
  routes: Annotation<IntelRoutesConfig>(),
  channels: Annotation<IntelChannelsConfig | undefined>(),
  repositories: Annotation<IntelRepositories>(),
  mcpClientManager: Annotation<IntelMcpClientManager | undefined>(),
  digestDate: Annotation<string | undefined>(),
  pendingDeliveries: Annotation<IntelRetryDeliveryRecord[] | undefined>(),
  retryableDeliveries: Annotation<IntelRetryDeliveryRecord[] | undefined>(),
  sentDeliveries: Annotation<IntelRetryDeliveryRecord[] | undefined>(),
  failedDeliveries: Annotation<IntelRetryDeliveryRecord[] | undefined>(),
  closedDeliveries: Annotation<IntelRetryDeliveryRecord[] | undefined>(),
  persistedDigestIds: Annotation<string[] | undefined>(),
  renderedDigests: Annotation<Array<Record<string, unknown>> | undefined>(),
  generatedAlerts: Annotation<IntelGraphState['generatedAlerts'] | undefined>(),
  queuedDeliveries: Annotation<IntelGraphState['queuedDeliveries'] | undefined>(),
  normalizedSignals: Annotation<IntelGraphState['normalizedSignals'] | undefined>(),
  mergedSignals: Annotation<IntelGraphState['mergedSignals'] | undefined>(),
  scoredSignals: Annotation<IntelGraphState['scoredSignals'] | undefined>(),
  rawResults: Annotation<IntelGraphState['rawResults'] | undefined>(),
  errors: Annotation<string[] | undefined>()
});

async function runPatrolState(state: IntelGraphState): Promise<Partial<IntelGraphState>> {
  const result = await executePatrolIntelRun({
    jobId: state.jobId,
    startedAt: state.startedAt,
    sources: state.sources!,
    routes: state.routes,
    repositories: state.repositories,
    mcpClientManager: state.mcpClientManager
  });

  return {
    rawResults: result.rawResults,
    normalizedSignals: result.normalizedSignals,
    mergedSignals: result.mergedSignals,
    scoredSignals: result.scoredSignals,
    generatedAlerts: result.generatedAlerts,
    queuedDeliveries: result.queuedDeliveries,
    errors: result.errors
  };
}

async function runDigestState(state: IntelGraphState): Promise<Partial<IntelGraphState>> {
  const result = await executeDigestIntelRun({
    jobId: state.jobId,
    startedAt: state.startedAt,
    routes: state.routes,
    repositories: {
      signals: {
        listInWindow: input => state.repositories.signals.listInWindow(input)
      },
      digests: {
        createDailyDigest: input => state.repositories.dailyDigests.createDailyDigest(input),
        linkSignals: (digestId, signalIds) => state.repositories.dailyDigests.linkSignals(digestId, signalIds)
      },
      deliveries: {
        insert: input =>
          state.repositories.deliveries.insert({
            ...input,
            updatedAt: input.createdAt
          })
      },
      signalSources: {
        listBySignalIds: signalIds => state.repositories.signalSources.listBySignalIds(signalIds)
      }
    }
  });

  return {
    digestDate: result.digestDate,
    persistedDigestIds: result.persistedDigest ? [result.persistedDigest.digestId] : [],
    renderedDigests: result.renderedDigest
      ? [
          {
            digestDate: result.digestDate,
            title: result.renderedDigest.title,
            markdown: result.renderedDigest.markdown,
            category: 'daily'
          }
        ]
      : [],
    queuedDeliveries: result.queuedDeliveries,
    errors: result.errors
  };
}

async function runRetryState(state: IntelGraphState): Promise<Partial<IntelGraphState>> {
  const result = await retryIntelDeliveries({
    jobId: state.jobId,
    startedAt: state.startedAt,
    channels: state.channels!,
    pendingDeliveries: state.pendingDeliveries ?? []
  });

  return {
    pendingDeliveries: result.pendingDeliveries,
    retryableDeliveries: result.retryableDeliveries,
    sentDeliveries: result.sentDeliveries,
    failedDeliveries: result.failedDeliveries,
    closedDeliveries: result.closedDeliveries
  };
}

export function createIntelGraph(handlers: IntelGraphHandlers = {}) {
  return new StateGraph(IntelGraphAnnotation)
    .addNode('dispatch', (state: IntelGraphState) => state)
    .addNode('executePatrol', state => (handlers.executePatrol ? handlers.executePatrol(state) : runPatrolState(state)))
    .addNode('executeDigest', state => (handlers.executeDigest ? handlers.executeDigest(state) : runDigestState(state)))
    .addNode('executeRetry', state => (handlers.executeRetry ? handlers.executeRetry(state) : runRetryState(state)))
    .addEdge(START, 'dispatch')
    .addConditionalEdges('dispatch', state => {
      if (state.mode === 'digest') {
        return 'executeDigest';
      }

      if (state.mode === 'delivery_retry') {
        return 'executeRetry';
      }

      return 'executePatrol';
    })
    .addEdge('executePatrol', END)
    .addEdge('executeDigest', END)
    .addEdge('executeRetry', END);
}
