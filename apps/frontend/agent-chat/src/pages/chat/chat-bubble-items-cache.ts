import type { BubbleItemType } from '@ant-design/x';

import type { BuildBubbleItemsOptions } from './chat-message-adapter';
import { buildBubbleItems } from './chat-message-adapter';

export interface ChatBubbleItemsCache {
  readonly entriesByMessageId: Map<string, ChatBubbleItemCacheEntry>;
}

interface ChatBubbleItemCacheEntry {
  readonly item: BubbleItemType;
  readonly deps: readonly unknown[];
}

export function createEmptyChatBubbleItemsCache(): ChatBubbleItemsCache {
  return { entriesByMessageId: new Map() };
}

export function buildCachedBubbleItems(
  options: BuildBubbleItemsOptions,
  previousCache: ChatBubbleItemsCache | undefined
): { items: BubbleItemType[]; cache: ChatBubbleItemsCache } {
  const newItems = buildBubbleItems(options);
  if (!previousCache) {
    const nextEntries = new Map<string, ChatBubbleItemCacheEntry>();
    for (const item of newItems) {
      const key = item.key as string;
      nextEntries.set(key, { item, deps: stableBubbleDepsForKey(key, options) });
    }
    return { items: newItems, cache: { entriesByMessageId: nextEntries } };
  }

  // Build new items list, reusing cached items for unchanged messages
  const nextEntries = new Map<string, ChatBubbleItemCacheEntry>();
  const items: BubbleItemType[] = [];

  for (const newItem of newItems) {
    const key = newItem.key as string;
    const newDeps = stableBubbleDepsForKey(key, options);
    const previous = previousCache.entriesByMessageId.get(key);

    if (previous && areDepsEqual(previous.deps, newDeps)) {
      // Message unchanged — reuse cached item to preserve reference
      nextEntries.set(key, previous);
      items.push(previous.item);
    } else {
      // Message changed or new — use new item
      nextEntries.set(key, { item: newItem, deps: newDeps });
      items.push(newItem);
    }
  }

  return { items, cache: { entriesByMessageId: nextEntries } };
}

function stableBubbleDepsForKey(messageId: string, options: BuildBubbleItemsOptions): readonly unknown[] {
  const record = options.messages.find(message => message.id === messageId);
  if (!record) {
    return [messageId, options.activeStatus, options.agentThinking, options.streamingCompleted];
  }

  return [
    record.id,
    record.content,
    record.role,
    record.sessionId,
    record.taskId ?? null,
    record.createdAt,
    options.activeStatus,
    options.agentThinking,
    options.streamingCompleted,
    options.copiedMessageId,
    options.cognitionTargetMessageId,
    options.cognitionExpandedByMessageId?.[record.id]
  ];
}

function areDepsEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
