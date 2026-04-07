import type {
  ChatCheckpointRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatThinkState,
  ChatThoughtChainItem,
  CheckpointRef,
  TaskRecord,
  ThoughtGraphEdge,
  ThoughtGraphNode
} from '@agent/shared';
import { getMinistryDisplayName, normalizeExecutionMode, TaskStatus } from '@agent/shared';
import type { ContextStrategy } from '@agent/config';
import type { MemorySearchService } from '@agent/memory';

import type { LlmProvider } from '../adapters/llm/llm-provider';
import { compressConversationIfNeeded as compressSessionConversationIfNeeded } from './session-coordinator-compression';
import { buildSessionConversationContext } from './session-coordinator-thinking-context';
import {
  buildSessionThinkState,
  buildSessionThoughtChain,
  buildSessionThoughtGraph
} from './session-coordinator-thinking-helpers';

export class SessionCoordinatorThinking {
  constructor(
    private readonly llm: LlmProvider,
    private readonly contextStrategy: ContextStrategy | undefined,
    private readonly memorySearchService: MemorySearchService | undefined
  ) {}

  async buildConversationContext(
    session: ChatSessionRecord,
    checkpoint: ChatCheckpointRecord | undefined,
    messages: ChatMessageRecord[],
    query: string
  ): Promise<string> {
    return buildSessionConversationContext(
      session,
      checkpoint,
      messages,
      query,
      this.contextStrategy,
      this.memorySearchService
    );
  }

  buildThoughtChain(task: TaskRecord, messageId?: string): ChatThoughtChainItem[] {
    return buildSessionThoughtChain(task, messageId);
  }

  buildThinkState(task: TaskRecord, messageId?: string): ChatThinkState | undefined {
    return buildSessionThinkState(task, messageId);
  }

  buildThoughtGraph(
    task: TaskRecord,
    checkpoint: ChatCheckpointRecord
  ): { nodes: ThoughtGraphNode[]; edges: ThoughtGraphEdge[] } {
    return buildSessionThoughtGraph(task, checkpoint);
  }

  async compressConversationIfNeeded(
    session: ChatSessionRecord,
    messages: ChatMessageRecord[],
    onCompacted: (payload: Record<string, unknown>) => void,
    latestUserInput?: string
  ): Promise<boolean> {
    return compressSessionConversationIfNeeded(
      this.llm,
      this.contextStrategy,
      session,
      messages,
      onCompacted,
      latestUserInput
    );
  }
}
