import type { IntelligenceChannel } from './intelligence.types';

export interface IntelligenceQueryTemplate {
  direction: 'official-confirmation' | 'trend-discovery' | 'security-watch';
  query: string;
}

export interface IntelligenceChannelDefinition {
  channel: IntelligenceChannel;
  label: string;
  schedule: 'daily' | 'every-4-hours';
  queries: IntelligenceQueryTemplate[];
}

export interface IntelligenceSearchTask {
  id: string;
  runId: string;
  channel: IntelligenceChannel;
  direction: IntelligenceQueryTemplate['direction'];
  query: string;
  provider: 'minimax-cli';
  scheduledFor: string;
}

export const INTELLIGENCE_CHANNELS: IntelligenceChannelDefinition[] = [
  {
    channel: 'frontend-tech',
    label: 'Frontend Tech',
    schedule: 'daily',
    queries: [
      {
        direction: 'official-confirmation',
        query: 'React Next.js Vue Vite TypeScript official release breaking changes latest'
      },
      { direction: 'trend-discovery', query: 'Chrome Web Platform CSS baseline stable feature latest' },
      { direction: 'official-confirmation', query: 'frontend framework migration guide compatibility latest' }
    ]
  },
  {
    channel: 'frontend-security',
    label: 'Frontend Security',
    schedule: 'every-4-hours',
    queries: [
      { direction: 'security-watch', query: 'npm pnpm package compromise frontend supply chain vulnerability latest' },
      { direction: 'security-watch', query: 'axios Vite plugin source map token leak security advisory latest' },
      { direction: 'security-watch', query: 'Chrome browser V8 WebAssembly frontend security vulnerability latest' }
    ]
  },
  {
    channel: 'llm-releases',
    label: 'LLM Releases',
    schedule: 'daily',
    queries: [
      {
        direction: 'official-confirmation',
        query: 'OpenAI Anthropic Google Gemini DeepSeek Qwen Mistral MiniMax new model release API latest'
      },
      {
        direction: 'trend-discovery',
        query: 'LLM model pricing context window tool calling multimodal release latest'
      },
      {
        direction: 'official-confirmation',
        query: 'GPT Claude Gemini Qwen DeepSeek model deprecation migration API changes'
      }
    ]
  },
  {
    channel: 'skills-agent-tools',
    label: 'Skills & Agent Tools',
    schedule: 'daily',
    queries: [
      {
        direction: 'trend-discovery',
        query: 'Codex skills Claude Code skills MCP server agent workflow template latest'
      },
      {
        direction: 'trend-discovery',
        query: 'best AI coding agent skills GitHub PR review browser automation documentation automation'
      },
      {
        direction: 'official-confirmation',
        query: 'Model Context Protocol server release filesystem browser github slack notion'
      }
    ]
  },
  {
    channel: 'ai-security',
    label: 'AI Security',
    schedule: 'every-4-hours',
    queries: [
      { direction: 'security-watch', query: 'Claude Code source code leak security incident latest' },
      { direction: 'security-watch', query: 'MCP security prompt injection tool abuse workspace trust vulnerability' },
      {
        direction: 'security-watch',
        query: 'AI coding agent credential leak source code leak supply chain vulnerability'
      }
    ]
  },
  {
    channel: 'ai-product-platform',
    label: 'AI Product & Platform',
    schedule: 'daily',
    queries: [
      {
        direction: 'official-confirmation',
        query: 'OpenAI Anthropic Gemini MiniMax API pricing rate limit enterprise update latest'
      },
      {
        direction: 'official-confirmation',
        query: 'LLM API model retirement deprecation migration schedule latest'
      },
      {
        direction: 'official-confirmation',
        query: 'AI platform policy data retention enterprise admin controls latest'
      }
    ]
  }
];

export function buildIntelligenceSearchTasks(input: { runId: string; now: Date }): IntelligenceSearchTask[] {
  return INTELLIGENCE_CHANNELS.flatMap(channel =>
    channel.queries.map((query, index) => ({
      id: `${input.runId}:${channel.channel}:${index}`,
      runId: input.runId,
      channel: channel.channel,
      direction: query.direction,
      query: query.query,
      provider: 'minimax-cli',
      scheduledFor: input.now.toISOString()
    }))
  );
}
