import type { IntelDelivery, IntelSignal, IntelSignalSource } from '../../types';

import type { IntelRoutesConfig } from '../../flows/intel/schemas/intel-config.schema';
import { collectDigestSignalsNode } from '../../flows/intel/nodes/collect-digest-signals';
import { enqueueDigestDeliveriesNode } from '../../flows/intel/nodes/enqueue-digest-deliveries';
import { groupDigestSignalsNode } from '../../flows/intel/nodes/group-digest-signals';
import { matchDigestRoutesNode } from '../../flows/intel/nodes/match-digest-routes';
import { rankDigestHighlightsNode } from '../../flows/intel/nodes/rank-digest-highlights';
import { renderDigestContentNode } from '../../flows/intel/nodes/render-digest-content';
import {
  DigestGraphStateSchema,
  type DigestGraphState,
  type DigestSignalEvidence
} from '../../flows/intel/schemas/digest-graph-state.schema';

type MaybePromise<T> = T | Promise<T>;

interface DigestSignalWindowRepository {
  listInWindow(input: { startAt: string; endAt: string }): MaybePromise<IntelSignal[]>;
}

interface CreateDailyDigestInput {
  id: string;
  digestDate: string;
  title: string;
  content: string;
  signalCount: number;
  highlightCount: number;
  createdAt: string;
}

interface DigestPersistenceRepository {
  createDailyDigest(input: CreateDailyDigestInput): MaybePromise<string>;
  linkSignals(digestId: string, signalIds: string[]): MaybePromise<void>;
}

interface DigestDeliveryRepository {
  insert(input: Omit<IntelDelivery, 'alertId'>): MaybePromise<string>;
}

interface DigestSignalSourceRepository {
  listBySignalIds(signalIds: string[]): MaybePromise<IntelSignalSource[]>;
}

export interface DigestIntelRepositories {
  signals: DigestSignalWindowRepository;
  digests: DigestPersistenceRepository;
  deliveries: DigestDeliveryRepository;
  signalSources: DigestSignalSourceRepository;
}

export interface ExecuteDigestIntelRunInput {
  jobId: string;
  startedAt: string;
  routes: IntelRoutesConfig;
  repositories: DigestIntelRepositories;
}

function createDigestId(digestDate: string): string {
  return `digest_${digestDate}`;
}

function buildSignalEvidence(signalSources: IntelSignalSource[]): Record<string, DigestSignalEvidence> {
  const evidenceBySignalId: Record<string, DigestSignalEvidence> = {};

  for (const source of signalSources) {
    const current =
      evidenceBySignalId[source.signalId] ??
      ({
        signalId: source.signalId,
        sourceCount: 0,
        officialSourceCount: 0,
        communitySourceCount: 0,
        references: []
      } satisfies DigestSignalEvidence);

    const hasReference = current.references.some(
      reference =>
        reference.url === source.url &&
        reference.sourceName === source.sourceName &&
        reference.sourceType === source.sourceType
    );

    evidenceBySignalId[source.signalId] = {
      ...current,
      sourceCount: current.sourceCount + 1,
      officialSourceCount: current.officialSourceCount + (source.sourceType === 'official' ? 1 : 0),
      communitySourceCount: current.communitySourceCount + (source.sourceType === 'community' ? 1 : 0),
      references: hasReference
        ? current.references
        : [
            ...current.references,
            {
              sourceName: source.sourceName,
              sourceType: source.sourceType,
              url: source.url
            }
          ]
    };
  }

  return evidenceBySignalId;
}

export async function executeDigestIntelRun(input: ExecuteDigestIntelRunInput): Promise<DigestGraphState> {
  const seedState = collectDigestSignalsNode({
    jobId: input.jobId,
    startedAt: input.startedAt,
    signals: await input.repositories.signals.listInWindow({
      startAt: `${input.startedAt.slice(0, 10)}T00:00:00.000Z`,
      endAt: new Date(Date.parse(`${input.startedAt.slice(0, 10)}T00:00:00.000Z`) + 24 * 60 * 60 * 1000).toISOString()
    })
  });
  const groupedState = groupDigestSignalsNode(seedState);
  const rankedState = rankDigestHighlightsNode(groupedState);
  const signalEvidence = buildSignalEvidence(
    await input.repositories.signalSources.listBySignalIds(rankedState.collectedSignals.map(signal => signal.id))
  );
  const renderedState = renderDigestContentNode({
    ...rankedState,
    signalEvidence
  });
  const highlightedSignalIds = rankedState.highlights.map(highlight => highlight.signal.id);

  if (renderedState.renderedDigest === undefined || highlightedSignalIds.length === 0) {
    return DigestGraphStateSchema.parse({
      ...renderedState,
      matchedRoutes: [],
      queuedDeliveries: []
    });
  }

  const digestId = createDigestId(renderedState.digestDate);
  const persistedDigestId = await input.repositories.digests.createDailyDigest({
    id: digestId,
    digestDate: renderedState.digestDate,
    title: renderedState.renderedDigest.title,
    content: renderedState.renderedDigest.markdown,
    signalCount: renderedState.collectedSignals.length,
    highlightCount: renderedState.highlights.length,
    createdAt: input.startedAt
  });
  await input.repositories.digests.linkSignals(persistedDigestId, highlightedSignalIds);

  const matched = matchDigestRoutesNode({
    signals: renderedState.collectedSignals,
    routes: input.routes
  });
  const primarySignalId = renderedState.highlights[0]?.signal.id ?? renderedState.collectedSignals[0]?.id;
  const queued =
    primarySignalId === undefined
      ? []
      : enqueueDigestDeliveriesNode({
          digestId: persistedDigestId,
          signalId: primarySignalId,
          now: input.startedAt,
          matchedRoutes: matched.matchedRoutes
        }).queuedDeliveries;

  for (const delivery of queued) {
    await input.repositories.deliveries.insert({
      id: delivery.id,
      signalId: delivery.signalId,
      channelType: delivery.channelType,
      channelTarget: delivery.channelTarget,
      deliveryKind: delivery.deliveryKind,
      deliveryStatus: delivery.deliveryStatus,
      retryCount: delivery.retryCount,
      createdAt: delivery.createdAt
    });
  }

  return DigestGraphStateSchema.parse({
    ...renderedState,
    persistedDigest: {
      digestId: persistedDigestId,
      digestDate: renderedState.digestDate,
      linkedSignalIds: highlightedSignalIds
    },
    matchedRoutes: matched.matchedRoutes,
    queuedDeliveries: queued,
    stats: {
      collectedSignals: renderedState.collectedSignals.length,
      groupedSignals: renderedState.groupedSignals.length,
      highlights: renderedState.highlights.length,
      matchedRoutes: matched.matchedRoutes.length,
      queuedDeliveries: queued.length
    }
  });
}
