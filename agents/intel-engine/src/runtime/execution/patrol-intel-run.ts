import type { IntelRoutesConfig, IntelSourcesConfig } from '../../flows/intel/schemas/intel-config.schema';
import { attachSignalSources } from '../../flows/intel/nodes/attach-signal-sources';
import { buildSearchTasksNode } from '../../flows/intel/nodes/build-search-tasks';
import { decideAlertsNode } from '../../flows/intel/nodes/decide-alerts';
import { dedupeAndMergeNode } from '../../flows/intel/nodes/dedupe-and-merge';
import { enqueueDeliveriesNode } from '../../flows/intel/nodes/enqueue-deliveries';
import { loadSourceConfigNode } from '../../flows/intel/nodes/load-source-config';
import { matchRoutesNode } from '../../flows/intel/nodes/match-routes';
import { normalizeSignalsNode } from '../../flows/intel/nodes/normalize-signals';
import { persistRawEventsNode } from '../../flows/intel/nodes/persist-raw-events';
import { runWebSearchNode } from '../../flows/intel/nodes/run-web-search';
import { scoreSignalNode } from '../../flows/intel/nodes/score-signal';
import type { PatrolGraphState } from '../../flows/intel/schemas/patrol-graph-state.schema';
import type { IntelRepositories } from '../../runtime/storage/intel.repositories';

interface PatrolMcpClientManager {
  hasCapability(capabilityId: string): boolean;
  invokeTool: Parameters<typeof runWebSearchNode>[1]['mcpClientManager'] extends infer T
    ? T extends { invokeTool: infer InvokeTool }
      ? InvokeTool
      : never
    : never;
}

export interface ExecutePatrolIntelRunInput {
  mode?: PatrolGraphState['mode'];
  jobId: string;
  startedAt: string;
  sources: IntelSourcesConfig;
  routes: IntelRoutesConfig;
  repositories: IntelRepositories;
  mcpClientManager?: PatrolMcpClientManager;
}

export async function executePatrolIntelRun(input: ExecutePatrolIntelRunInput): Promise<PatrolGraphState> {
  const mode = input.mode ?? 'patrol';
  const withTopics = loadSourceConfigNode({
    mode,
    jobId: input.jobId,
    startedAt: input.startedAt,
    sources: input.sources
  });
  const withSearchTasks = buildSearchTasksNode(withTopics);
  const withSearchResults = await runWebSearchNode(withSearchTasks, {
    mcpClientManager: input.mcpClientManager
  });
  const withRawEvents = persistRawEventsNode({
    ...withSearchResults,
    repositories: input.repositories
  });
  const normalized = normalizeSignalsNode(withRawEvents);
  const existingSignals = input.repositories.signals.listByDedupeKeys(
    normalized.normalizedSignals.map(signal => signal.dedupeKey)
  );
  const merged = dedupeAndMergeNode({
    ...normalized,
    existingSignals,
    incomingSignals: normalized.normalizedSignals
  });
  const scored = scoreSignalNode(merged);
  const alerted = decideAlertsNode(scored);

  const routeMatches = alerted.scoredSignals.map(signal =>
    matchRoutesNode({
      signal: {
        id: signal.id,
        category: signal.category,
        priority: signal.priority,
        status: signal.status,
        title: signal.title
      },
      routes: input.routes
    })
  );

  const queuedDeliveries = routeMatches.flatMap(
    match =>
      enqueueDeliveriesNode({
        signalId: match.signalId,
        now: input.startedAt,
        routes: match.matches,
        existingDeliveries: [],
        suppressDuplicateHours: match.suppressionWindowHours
      }).queuedDeliveries
  );

  for (const signal of scored.scoredSignals) {
    input.repositories.signals.upsert(signal);
  }

  input.repositories.signalSources.insertMany(
    attachSignalSources({
      rawResults: withSearchResults.rawResults,
      normalizedSignals: normalized.normalizedSignals,
      signalMergeMap: merged.signalMergeMap,
      createdAt: input.startedAt
    })
  );

  for (const alert of alerted.generatedAlerts) {
    input.repositories.alerts.upsert(alert);

    for (const delivery of queuedDeliveries.filter(candidate => candidate.signalId === alert.signalId)) {
      input.repositories.deliveries.insert({
        id: delivery.id,
        signalId: delivery.signalId,
        alertId: alert.id,
        channelType: 'lark',
        channelTarget: delivery.channelTarget,
        deliveryKind: delivery.deliveryKind,
        deliveryStatus: delivery.deliveryStatus,
        retryCount: delivery.retryCount,
        createdAt: delivery.createdAt
      });
    }
  }

  return {
    ...alerted,
    matchedRoutes: routeMatches.map(match => ({
      routeId: match.ruleIds.join(','),
      channelTargets: match.deliveryTargets
    })),
    queuedDeliveries: queuedDeliveries.map(delivery => ({
      id: delivery.id,
      signalId: delivery.signalId,
      alertId: `alert_${delivery.signalId}`,
      channelType: 'lark',
      channelTarget: delivery.channelTarget,
      deliveryKind: delivery.deliveryKind,
      deliveryStatus: delivery.deliveryStatus,
      retryCount: delivery.retryCount,
      createdAt: delivery.createdAt
    }))
  };
}
