/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import { toKnowledgeConversationData } from '@/chat-runtime/knowledge-conversations';

describe('toKnowledgeConversationData', () => {
  it('maps conversation with activeModelProfileId', () => {
    const result = toKnowledgeConversationData({
      id: 'conv-1',
      title: 'My Chat',
      activeModelProfileId: 'gpt-4'
    } as any);

    expect(result.key).toBe('conv-1');
    expect(result.label).toBe('My Chat');
    expect(result.group).toBe('gpt-4');
  });

  it('defaults group to knowledge-rag when no activeModelProfileId', () => {
    const result = toKnowledgeConversationData({
      id: 'conv-2',
      title: 'Another Chat'
    } as any);

    expect(result.key).toBe('conv-2');
    expect(result.label).toBe('Another Chat');
    expect(result.group).toBe('knowledge-rag');
  });

  it('defaults group to knowledge-rag when activeModelProfileId is undefined', () => {
    const result = toKnowledgeConversationData({
      id: 'conv-3',
      title: 'Chat Three',
      activeModelProfileId: undefined
    } as any);

    expect(result.group).toBe('knowledge-rag');
  });

  it('handles empty title', () => {
    const result = toKnowledgeConversationData({
      id: 'conv-4',
      title: ''
    } as any);

    expect(result.label).toBe('');
  });
});
