import { createHash } from 'node:crypto';

import {
  ActionIntent,
  type IntelligenceChannel,
  type IntelligenceConfidence,
  type IntelligencePriority,
  type IntelligenceSourceGroup,
  type IntelligenceStatus
} from '@agent/core';
import {
  INTELLIGENCE_CHANNELS,
  decideIntelligenceKnowledgeCandidate,
  normalizeMiniMaxSearchPayload
} from '@agent/core';

import type {
  IntelligenceRawEventInput,
  IntelligenceRepository,
  IntelligenceSignalInput,
  IntelligenceSourceInput
} from './intelligence.repository';

interface IntelligenceRunMcpClientManager {
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

export interface RuntimeIntelligenceRunContext {
  workspaceRoot: string;
  repository: IntelligenceRepository;
  mcpClientManager?: IntelligenceRunMcpClientManager;
}

export interface IntelligenceForceRunResult {
  ok: true;
  channel: IntelligenceChannel;
  status: 'completed' | 'partial' | 'skipped';
  acceptedAt: string;
  summary: {
    queries: number;
    rawEvents: number;
    signals: number;
    candidates: number;
    failedQueries: number;
    skippedQueries: number;
  };
}

export class RuntimeIntelligenceRunService {
  constructor(private readonly getContext: () => RuntimeIntelligenceRunContext) {}

  async forceRun(channel: IntelligenceChannel, now = new Date()): Promise<IntelligenceForceRunResult> {
    const ctx = this.getContext();
    const definition = INTELLIGENCE_CHANNELS.find(candidate => candidate.channel === channel);
    if (!definition) {
      throw new Error(`Unsupported intelligence channel: ${channel}`);
    }

    const acceptedAt = now.toISOString();
    const runId = `intel_${channel}_${createHash('sha1').update(`${channel}:${acceptedAt}`).digest('hex').slice(0, 12)}`;
    await ctx.repository.saveRun({
      id: runId,
      workspaceId: workspaceIdFor(ctx.workspaceRoot),
      runKind: 'forced',
      status: 'running',
      startedAt: acceptedAt,
      triggeredBy: 'platform.force-run',
      summary: { channel }
    });

    let rawEvents = 0;
    let failedQueries = 0;
    let skippedQueries = 0;
    const signalIds = new Set<string>();
    const candidateIds = new Set<string>();

    for (const [index, template] of definition.queries.entries()) {
      const queryId = `${runId}:query:${index}`;
      if (!ctx.mcpClientManager?.hasCapability('webSearchPrime')) {
        skippedQueries += 1;
        await ctx.repository.saveQuery({
          id: queryId,
          runId,
          channel,
          direction: template.direction,
          query: template.query,
          provider: 'webSearchPrime',
          status: 'skipped',
          startedAt: acceptedAt,
          completedAt: acceptedAt,
          resultCount: 0,
          error: { reason: 'webSearchPrime_unavailable' }
        });
        continue;
      }

      const result = await ctx.mcpClientManager.invokeTool('webSearchPrime', {
        taskId: queryId,
        toolName: 'webSearchPrime',
        intent: ActionIntent.CALL_EXTERNAL_API,
        input: {
          query: template.query,
          goal: `Collect latest intelligence for ${definition.label}`,
          freshnessHint: definition.schedule === 'every-4-hours' ? 'urgent' : 'recent'
        },
        requestedBy: 'agent'
      });

      if (!result.ok) {
        failedQueries += 1;
        await ctx.repository.saveQuery({
          id: queryId,
          runId,
          channel,
          direction: template.direction,
          query: template.query,
          provider: 'webSearchPrime',
          status: 'failed',
          startedAt: acceptedAt,
          completedAt: acceptedAt,
          resultCount: 0,
          error: { message: result.errorMessage ?? 'webSearchPrime_failed' }
        });
        continue;
      }

      const events = normalizeMiniMaxSearchPayload({
        queryId,
        fetchedAt: acceptedAt,
        payload: result.rawOutput
      });
      rawEvents += events.length;
      await ctx.repository.saveQuery({
        id: queryId,
        runId,
        channel,
        direction: template.direction,
        query: template.query,
        provider: 'webSearchPrime',
        status: 'completed',
        startedAt: acceptedAt,
        completedAt: acceptedAt,
        resultCount: events.length
      });

      for (const event of events) {
        await ctx.repository.saveRawEvent(event);
        const signal = toSignal({
          event,
          channel,
          workspaceRoot: ctx.workspaceRoot,
          capturedAt: acceptedAt
        });
        const source = toSource({ event, signalId: signal.id, capturedAt: acceptedAt });
        await ctx.repository.upsertSignal(signal);
        await ctx.repository.saveSource(source);
        signalIds.add(signal.id);

        const decision = decideIntelligenceKnowledgeCandidate({
          signal,
          sourceGroups: [event.sourceGroup]
        });
        if (decision.reviewStatus === 'pending') {
          const candidateId = `candidate_${signal.id}`;
          await ctx.repository.saveCandidate({
            id: candidateId,
            signalId: signal.id,
            ...decision,
            createdAt: acceptedAt,
            metadata: {
              source: 'intelligence-runner',
              channel
            }
          });
          candidateIds.add(candidateId);
        }
      }
    }

    const status = resolveRunStatus(definition.queries.length, failedQueries, skippedQueries);
    await ctx.repository.saveRun({
      id: runId,
      workspaceId: workspaceIdFor(ctx.workspaceRoot),
      runKind: 'forced',
      status,
      startedAt: acceptedAt,
      completedAt: acceptedAt,
      triggeredBy: 'platform.force-run',
      summary: {
        channel,
        queries: definition.queries.length,
        rawEvents,
        signals: signalIds.size,
        candidates: candidateIds.size,
        failedQueries,
        skippedQueries
      }
    });

    return {
      ok: true,
      channel,
      status: status === 'failed' ? 'partial' : status,
      acceptedAt,
      summary: {
        queries: definition.queries.length,
        rawEvents,
        signals: signalIds.size,
        candidates: candidateIds.size,
        failedQueries,
        skippedQueries
      }
    };
  }
}

function toSignal(input: {
  event: IntelligenceRawEventInput;
  channel: IntelligenceChannel;
  workspaceRoot: string;
  capturedAt: string;
}): IntelligenceSignalInput {
  const stableTopicKey = `${input.channel}:${input.event.contentHash}`;
  const priority = priorityFor(input.channel);
  return {
    id: `signal_${input.event.contentHash.slice(0, 16)}`,
    workspaceId: workspaceIdFor(input.workspaceRoot),
    stableTopicKey,
    channel: input.channel,
    title: input.event.title,
    summary: input.event.snippet,
    priority,
    confidence: confidenceFor(input.event.sourceGroup),
    status: statusFor(input.event.sourceGroup),
    firstSeenAt: input.event.publishedAt ?? input.capturedAt,
    lastSeenAt: input.capturedAt,
    metadata: {
      source: 'intelligence-runner',
      sourceName: input.event.sourceName,
      sourceGroup: input.event.sourceGroup
    }
  };
}

function toSource(input: {
  event: IntelligenceRawEventInput;
  signalId: string;
  capturedAt: string;
}): IntelligenceSourceInput {
  return {
    id: `source_${input.event.contentHash.slice(0, 16)}`,
    signalId: input.signalId,
    rawEventId: input.event.id,
    sourceName: input.event.sourceName,
    sourceUrl: input.event.sourceUrl,
    url: input.event.url,
    sourceGroup: input.event.sourceGroup,
    snippet: input.event.snippet,
    publishedAt: input.event.publishedAt,
    capturedAt: input.capturedAt,
    metadata: {
      source: 'intelligence-runner'
    }
  };
}

function resolveRunStatus(
  queryCount: number,
  failedQueries: number,
  skippedQueries: number
): 'completed' | 'failed' | 'partial' {
  if (failedQueries === 0 && skippedQueries === 0) {
    return 'completed';
  }
  if (failedQueries + skippedQueries >= queryCount) {
    return 'failed';
  }
  return 'partial';
}

function priorityFor(channel: IntelligenceChannel): IntelligencePriority {
  return channel === 'frontend-security' || channel === 'ai-security' ? 'P1' : 'P2';
}

function confidenceFor(sourceGroup: IntelligenceSourceGroup): IntelligenceConfidence {
  return sourceGroup === 'official' || sourceGroup === 'authority' ? 'high' : 'medium';
}

function statusFor(sourceGroup: IntelligenceSourceGroup): IntelligenceStatus {
  return sourceGroup === 'official' || sourceGroup === 'authority' ? 'confirmed' : 'pending';
}

function workspaceIdFor(workspaceRoot: string): string {
  return `workspace_${createHash('sha1').update(workspaceRoot).digest('hex').slice(0, 12)}`;
}
