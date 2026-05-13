import { describe, expect, it } from 'vitest';

import { INTELLIGENCE_CHANNELS, buildIntelligenceSearchTasks } from '../../../src/runtime/intelligence';

describe('intelligence channels', () => {
  it('defines approved channels without RAG runtime engineering', () => {
    expect(INTELLIGENCE_CHANNELS.map(channel => channel.channel)).toEqual([
      'frontend-tech',
      'frontend-security',
      'llm-releases',
      'skills-agent-tools',
      'ai-security',
      'ai-product-platform'
    ]);
    expect(JSON.stringify(INTELLIGENCE_CHANNELS)).not.toMatch(/LangGraph|LangChain|LlamaIndex|RAG eval/i);
  });

  it('builds MiniMax query tasks for each channel', () => {
    const tasks = buildIntelligenceSearchTasks({
      runId: 'run_1',
      now: new Date('2026-05-10T01:00:00.000Z')
    });

    expect(new Set(tasks.map(task => task.channel))).toEqual(
      new Set([
        'frontend-tech',
        'frontend-security',
        'llm-releases',
        'skills-agent-tools',
        'ai-security',
        'ai-product-platform'
      ])
    );
    expect(tasks.every(task => task.provider === 'minimax-cli')).toBe(true);
    expect(tasks.some(task => task.query.includes('Claude Code source code leak'))).toBe(true);
  });
});
