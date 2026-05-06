import { describe, expect, it } from 'vitest';

import { KnowledgeChatRoutingError, resolveKnowledgeChatRoute } from '../src';

const bases = [
  { id: 'kb_frontend', name: '前端知识库', description: 'React Ant Design X 前端规范' },
  { id: 'kb_core', name: 'Core 包', description: 'core contract schema tasking 设计' },
  { id: 'kb_runtime', name: 'Runtime 知识库', description: 'LangGraph runtime interrupt graph' }
];

describe('resolveKnowledgeChatRoute', () => {
  it('keeps legacy knowledge base ids as the highest-priority route', () => {
    const route = resolveKnowledgeChatRoute({
      accessibleBases: bases,
      legacyBaseIds: ['kb_frontend'],
      mentions: [{ type: 'knowledge_base', id: 'kb_core', label: 'Core 包' }],
      message: 'core 包如何设计'
    });

    expect(route).toEqual({
      knowledgeBaseIds: ['kb_frontend'],
      reason: 'legacy_ids'
    });
  });

  it('resolves explicit metadata mentions by id or label before automatic routing', () => {
    const route = resolveKnowledgeChatRoute({
      accessibleBases: bases,
      metadata: {
        mentions: [
          { type: 'knowledge_base', id: 'kb_core', label: 'Core 包' },
          { type: 'knowledge_base', label: 'Runtime 知识库' }
        ]
      },
      message: '@Core 包 graph 怎么设计'
    });

    expect(route).toEqual({
      knowledgeBaseIds: ['kb_core', 'kb_runtime'],
      reason: 'mentions'
    });
  });

  it('throws a stable routing error when a mention cannot be bound', () => {
    expect(() =>
      resolveKnowledgeChatRoute({
        accessibleBases: bases,
        metadata: {
          mentions: [{ type: 'knowledge_base', label: '不存在的知识库' }]
        },
        message: '@不存在的知识库 怎么设计'
      })
    ).toThrow(KnowledgeChatRoutingError);
  });

  it('routes by knowledge base metadata before retrieval when no mention is present', () => {
    const route = resolveKnowledgeChatRoute({
      accessibleBases: bases,
      message: 'core contract schema 怎么演进'
    });

    expect(route).toEqual({
      knowledgeBaseIds: ['kb_core'],
      reason: 'metadata_match'
    });
  });

  it('falls back to every accessible knowledge base when no routing signal matches', () => {
    const route = resolveKnowledgeChatRoute({
      accessibleBases: bases,
      message: '完全没有匹配词'
    });

    expect(route).toEqual({
      knowledgeBaseIds: ['kb_frontend', 'kb_core', 'kb_runtime'],
      reason: 'fallback_all'
    });
  });
});
