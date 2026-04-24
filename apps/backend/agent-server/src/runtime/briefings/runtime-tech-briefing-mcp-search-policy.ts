import type {
  TechBriefingAuthorityTier,
  TechBriefingCategory,
  TechBriefingContentKind,
  TechBriefingSourceGroup
} from './runtime-tech-briefing.types';
import { FEED_SOURCES, FRONTEND_SECURITY_PAGE_SOURCES } from './runtime-tech-briefing-sources';

export const MCP_DISCOVERY_QUERIES: Record<TechBriefingCategory, string[]> = {
  'frontend-security': [
    'axios security advisory npm vulnerability latest',
    'Apifox security incident vulnerability latest',
    'frontend npm package vulnerability source map leak token exposure'
  ],
  'general-security': ['linux windows macos docker kubernetes postgres redis security advisory'],
  'devtool-security': [
    'Claude Code security incident source code leak credential leak latest',
    'Cursor MCP security advisory path traversal prompt injection latest',
    'AI coding tool security vulnerability latest'
  ],
  'ai-tech': [
    'OpenAI Anthropic Google DeepSeek Qwen Mistral new model release latest',
    'LLM model release context window multimodal pricing latest',
    'Vercel AI SDK LangGraph LangChain MCP SDK release latest'
  ],
  'frontend-tech': ['React Next.js Vite TypeScript browser release latest', 'Chrome DevTools frontend update latest'],
  'backend-tech': ['Node.js Bun Deno Go Rust Spring .NET release blog'],
  'cloud-infra-tech': ['Kubernetes Docker Terraform GitHub Actions GitLab CI release blog']
};

export interface McpSearchSourceMeta {
  name: string;
  sourceUrl: string;
  authorityTier: TechBriefingAuthorityTier;
  sourceGroup: TechBriefingSourceGroup;
  contentKind: TechBriefingContentKind;
}

const EXTRA_SEARCH_SOURCE_META: Array<{
  category: TechBriefingCategory;
  host: string;
  meta: McpSearchSourceMeta;
}> = [
  {
    category: 'devtool-security',
    host: 'anthropic.com',
    meta: {
      name: 'Anthropic News',
      sourceUrl: 'https://www.anthropic.com/news',
      authorityTier: 'official-blog',
      sourceGroup: 'official',
      contentKind: 'incident'
    }
  },
  {
    category: 'devtool-security',
    host: 'cursor.com',
    meta: {
      name: 'Cursor Security',
      sourceUrl: 'https://cursor.com',
      authorityTier: 'official-blog',
      sourceGroup: 'official',
      contentKind: 'incident'
    }
  },
  {
    category: 'devtool-security',
    host: 'modelcontextprotocol.io',
    meta: {
      name: 'Model Context Protocol',
      sourceUrl: 'https://modelcontextprotocol.io',
      authorityTier: 'official-blog',
      sourceGroup: 'official',
      contentKind: 'docs-update'
    }
  },
  {
    category: 'ai-tech',
    host: 'deepseek.com',
    meta: {
      name: 'DeepSeek News',
      sourceUrl: 'https://www.deepseek.com',
      authorityTier: 'official-blog',
      sourceGroup: 'official',
      contentKind: 'release'
    }
  },
  {
    category: 'ai-tech',
    host: 'qwenlm.github.io',
    meta: {
      name: 'Qwen Blog',
      sourceUrl: 'https://qwenlm.github.io',
      authorityTier: 'official-blog',
      sourceGroup: 'official',
      contentKind: 'release'
    }
  }
];

export function resolveMcpSearchSourceMeta(
  category: TechBriefingCategory,
  url: string
): McpSearchSourceMeta | undefined {
  const hostname = safeHostname(url);
  if (!hostname) {
    return undefined;
  }

  const sourceMeta = listRegisteredSourceMeta(category).find(source => {
    const sourceHost = safeHostname(source.sourceUrl);
    return sourceHost ? hostname === sourceHost || hostname.endsWith(`.${sourceHost}`) : false;
  });
  if (sourceMeta) {
    return sourceMeta;
  }

  return EXTRA_SEARCH_SOURCE_META.find(
    source => source.category === category && (hostname === source.host || hostname.endsWith(`.${source.host}`))
  )?.meta;
}

function listRegisteredSourceMeta(category: TechBriefingCategory): McpSearchSourceMeta[] {
  return [
    ...FEED_SOURCES.filter(source => source.category === category).map(source => ({
      name: source.name,
      sourceUrl: source.sourceUrl,
      authorityTier: source.authorityTier,
      sourceGroup: source.sourceGroup,
      contentKind: source.contentKind
    })),
    ...FRONTEND_SECURITY_PAGE_SOURCES.filter(source => source.category === category).map(source => ({
      name: source.name,
      sourceUrl: source.sourceUrl,
      authorityTier: source.authorityTier,
      sourceGroup: source.sourceGroup,
      contentKind: source.contentKind
    }))
  ];
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
