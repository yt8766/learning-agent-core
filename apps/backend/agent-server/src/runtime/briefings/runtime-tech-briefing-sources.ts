import type {
  TechBriefingAuthorityTier,
  TechBriefingCategory,
  TechBriefingContentKind,
  TechBriefingParserKind,
  TechBriefingSourceGroup,
  TechBriefingSourceType
} from './runtime-tech-briefing.types';

export interface FeedSourceRecord {
  id: string;
  category: Exclude<TechBriefingCategory, 'frontend-security' | 'general-security' | 'devtool-security'>;
  name: string;
  sourceUrl: string;
  feedUrl: string;
  sourceType: Extract<TechBriefingSourceType, 'rss' | 'atom'>;
  authorityTier: Exclude<TechBriefingAuthorityTier, 'official-advisory'>;
  sourceGroup: Exclude<TechBriefingSourceGroup, 'community'> | 'community';
  contentKind: Exclude<TechBriefingContentKind, 'advisory' | 'incident'>;
  parserKind?: Extract<TechBriefingParserKind, 'feed' | 'community-post'>;
  topicTags?: string[];
}

export interface NvdKeywordSourceRecord {
  id: string;
  category: 'frontend-security' | 'general-security';
  name: string;
  sourceUrl: string;
  sourceType: 'nvd-api';
  authorityTier: 'official-advisory';
  sourceGroup: 'official';
  contentKind: 'advisory';
  parserKind?: 'security-advisory';
  topicTags?: string[];
  keywords: string[];
}

export interface SecurityPageSourceRecord {
  id: string;
  category: 'frontend-security' | 'general-security' | 'devtool-security';
  name: string;
  sourceUrl: string;
  pageUrl: string;
  sourceType: 'security-page' | 'official-page';
  authorityTier: TechBriefingAuthorityTier;
  sourceGroup: TechBriefingSourceGroup;
  contentKind: Extract<TechBriefingContentKind, 'advisory' | 'incident' | 'community-discussion'>;
  parserKind?: Exclude<TechBriefingParserKind, 'feed'>;
  topicTags?: string[];
  pageKind: 'github-advisory' | 'gitlab-advisory' | 'incident-page' | 'media-incident';
}

export const FEED_SOURCES: FeedSourceRecord[] = [
  {
    id: 'openai-news',
    category: 'ai-tech',
    name: 'OpenAI News',
    sourceUrl: 'https://openai.com/news/',
    feedUrl: 'https://openai.com/news/rss.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['ai', 'model', 'api', 'agent']
  },
  {
    id: 'huggingface-blog',
    category: 'ai-tech',
    name: 'Hugging Face Blog',
    sourceUrl: 'https://huggingface.co/blog',
    feedUrl: 'https://huggingface.co/blog/feed.xml',
    sourceType: 'atom',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['ai', 'open-source', 'agent', 'workflow']
  },
  {
    id: 'google-ai-blog',
    category: 'ai-tech',
    name: 'Google AI Blog',
    sourceUrl: 'https://blog.google/technology/ai/',
    feedUrl: 'https://blog.google/technology/ai/rss/',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['ai', 'model', 'research']
  },
  {
    id: 'anthropic-news',
    category: 'ai-tech',
    name: 'Anthropic News',
    sourceUrl: 'https://www.anthropic.com/news',
    feedUrl: 'https://www.anthropic.com/news/rss.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['ai', 'api', 'agent']
  },
  {
    id: 'mistral-news',
    category: 'ai-tech',
    name: 'Mistral News',
    sourceUrl: 'https://mistral.ai/news/',
    feedUrl: 'https://mistral.ai/news/rss.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['ai', 'model', 'inference']
  },
  {
    id: 'langchain-blog',
    category: 'ai-tech',
    name: 'LangChain Blog',
    sourceUrl: 'https://blog.langchain.com/',
    feedUrl: 'https://blog.langchain.com/rss/',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['ai', 'langchain', 'framework', 'workflow']
  },
  {
    id: 'vercel-ai-sdk',
    category: 'ai-tech',
    name: 'Vercel AI SDK',
    sourceUrl: 'https://vercel.com/changelog',
    feedUrl: 'https://vercel.com/changelog/rss.xml',
    sourceType: 'rss',
    authorityTier: 'official-release',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['ai', 'sdk', 'api', 'vercel']
  },
  {
    id: 'latent-space',
    category: 'ai-tech',
    name: 'Latent Space',
    sourceUrl: 'https://www.latent.space/',
    feedUrl: 'https://www.latent.space/rss/',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'benchmark',
    parserKind: 'feed',
    topicTags: ['ai', 'benchmark', 'media']
  },
  {
    id: 'simon-willison-weblog',
    category: 'ai-tech',
    name: 'Simon Willison Blog',
    sourceUrl: 'https://simonwillison.net/',
    feedUrl: 'https://simonwillison.net/atom/everything/',
    sourceType: 'atom',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['ai', 'agent', 'tooling']
  },
  {
    id: 'hacker-news-ai',
    category: 'ai-tech',
    name: 'Hacker News / AI',
    sourceUrl: 'https://news.ycombinator.com/',
    feedUrl: 'https://hnrss.org/newest?q=AI+agent+LLM+OpenAI+Anthropic+LangChain&points=50',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'community',
    contentKind: 'community-discussion',
    parserKind: 'community-post',
    topicTags: ['ai', 'community']
  },
  {
    id: 'react-blog',
    category: 'frontend-tech',
    name: 'React Blog',
    sourceUrl: 'https://react.dev/blog',
    feedUrl: 'https://react.dev/feed.xml',
    sourceType: 'atom',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['frontend', 'react', 'rsc']
  },
  {
    id: 'vite-blog',
    category: 'frontend-tech',
    name: 'Vite Blog',
    sourceUrl: 'https://vite.dev/blog/',
    feedUrl: 'https://vite.dev/blog.rss',
    sourceType: 'rss',
    authorityTier: 'official-release',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['frontend', 'vite', 'bundler']
  },
  {
    id: 'vue-blog',
    category: 'frontend-tech',
    name: 'Vue Blog',
    sourceUrl: 'https://blog.vuejs.org/',
    feedUrl: 'https://blog.vuejs.org/feed.xml',
    sourceType: 'atom',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['frontend', 'vue', 'framework']
  },
  {
    id: 'typescript-blog',
    category: 'frontend-tech',
    name: 'TypeScript Blog',
    sourceUrl: 'https://devblogs.microsoft.com/typescript/',
    feedUrl: 'https://devblogs.microsoft.com/typescript/feed/',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['frontend', 'typescript', 'language']
  },
  {
    id: 'eslint-blog',
    category: 'frontend-tech',
    name: 'ESLint Blog',
    sourceUrl: 'https://eslint.org/blog/',
    feedUrl: 'https://eslint.org/feed.xml',
    sourceType: 'rss',
    authorityTier: 'official-release',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['frontend', 'eslint', 'tooling']
  },
  {
    id: 'astro-blog',
    category: 'frontend-tech',
    name: 'Astro Blog',
    sourceUrl: 'https://astro.build/blog/',
    feedUrl: 'https://astro.build/rss.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['frontend', 'astro', 'ssr', 'vite']
  },
  {
    id: 'nextjs-blog',
    category: 'frontend-tech',
    name: 'Next.js Blog',
    sourceUrl: 'https://nextjs.org/blog',
    feedUrl: 'https://nextjs.org/feed.xml',
    sourceType: 'rss',
    authorityTier: 'official-release',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['frontend', 'nextjs', 'ssr', 'adapter']
  },
  {
    id: 'web-dev',
    category: 'frontend-tech',
    name: 'web.dev',
    sourceUrl: 'https://web.dev/blog/',
    feedUrl: 'https://web.dev/feed.xml',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['frontend', 'web-api', 'browser']
  },
  {
    id: 'smashing-magazine',
    category: 'frontend-tech',
    name: 'Smashing Magazine',
    sourceUrl: 'https://www.smashingmagazine.com/',
    feedUrl: 'https://www.smashingmagazine.com/feed/',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['frontend', 'css', 'design-system', 'browser']
  },
  {
    id: 'css-tricks',
    category: 'frontend-tech',
    name: 'CSS-Tricks',
    sourceUrl: 'https://css-tricks.com/',
    feedUrl: 'https://css-tricks.com/feed/',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['frontend', 'css', 'browser']
  },
  {
    id: 'frontend-focus',
    category: 'frontend-tech',
    name: 'Frontend Focus',
    sourceUrl: 'https://frontendfoc.us/',
    feedUrl: 'https://frontendfoc.us/rss',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['frontend', 'weekly', 'tooling']
  },
  {
    id: 'chrome-developers-blog',
    category: 'frontend-tech',
    name: 'Chrome Developers',
    sourceUrl: 'https://developer.chrome.com/blog',
    feedUrl: 'https://developer.chrome.com/blog/feed.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['frontend', 'browser', 'chrome']
  },
  {
    id: 'cloudflare-blog',
    category: 'frontend-tech',
    name: 'Cloudflare Blog',
    sourceUrl: 'https://blog.cloudflare.com/',
    feedUrl: 'https://blog.cloudflare.com/rss/',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['frontend', 'edge', 'platform']
  },
  {
    id: 'vercel-blog',
    category: 'frontend-tech',
    name: 'Vercel Blog',
    sourceUrl: 'https://vercel.com/blog',
    feedUrl: 'https://vercel.com/blog/rss.xml',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['frontend', 'nextjs', 'deployment']
  },
  {
    id: 'hacker-news-frontend',
    category: 'frontend-tech',
    name: 'Hacker News / Frontend',
    sourceUrl: 'https://news.ycombinator.com/',
    feedUrl: 'https://hnrss.org/newest?q=React+Vite+Next.js+TypeScript+Web+Platform&points=40',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'community',
    contentKind: 'community-discussion',
    parserKind: 'community-post',
    topicTags: ['frontend', 'community']
  },
  {
    id: 'nodejs-blog',
    category: 'backend-tech',
    name: 'Node.js Blog',
    sourceUrl: 'https://nodejs.org/en/blog',
    feedUrl: 'https://nodejs.org/en/feed/blog.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['backend', 'nodejs', 'runtime']
  },
  {
    id: 'bun-blog',
    category: 'backend-tech',
    name: 'Bun Blog',
    sourceUrl: 'https://bun.sh/blog',
    feedUrl: 'https://bun.sh/blog/rss.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['backend', 'bun', 'runtime']
  },
  {
    id: 'deno-blog',
    category: 'backend-tech',
    name: 'Deno Blog',
    sourceUrl: 'https://deno.com/blog',
    feedUrl: 'https://deno.com/feed.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['backend', 'deno', 'runtime']
  },
  {
    id: 'go-blog',
    category: 'backend-tech',
    name: 'Go Blog',
    sourceUrl: 'https://go.dev/blog',
    feedUrl: 'https://go.dev/blog/feed.atom',
    sourceType: 'atom',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['backend', 'go', 'language']
  },
  {
    id: 'rust-blog',
    category: 'backend-tech',
    name: 'Rust Blog',
    sourceUrl: 'https://blog.rust-lang.org/',
    feedUrl: 'https://blog.rust-lang.org/feed.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['backend', 'rust', 'language']
  },
  {
    id: 'spring-blog',
    category: 'backend-tech',
    name: 'Spring Blog',
    sourceUrl: 'https://spring.io/blog',
    feedUrl: 'https://spring.io/blog.atom',
    sourceType: 'atom',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['backend', 'spring', 'java']
  },
  {
    id: 'dotnet-blog',
    category: 'backend-tech',
    name: '.NET Blog',
    sourceUrl: 'https://devblogs.microsoft.com/dotnet/',
    feedUrl: 'https://devblogs.microsoft.com/dotnet/feed/',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['backend', 'dotnet', 'runtime']
  },
  {
    id: 'infoq-architecture',
    category: 'backend-tech',
    name: 'InfoQ Architecture',
    sourceUrl: 'https://www.infoq.com/architecture-design/',
    feedUrl: 'https://feed.infoq.com/architecture-design',
    sourceType: 'rss',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['backend', 'architecture', 'java']
  },
  {
    id: 'kubernetes-blog',
    category: 'cloud-infra-tech',
    name: 'Kubernetes Blog',
    sourceUrl: 'https://kubernetes.io/blog/',
    feedUrl: 'https://kubernetes.io/feed.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['cloud', 'kubernetes', 'infra']
  },
  {
    id: 'docker-blog',
    category: 'cloud-infra-tech',
    name: 'Docker Blog',
    sourceUrl: 'https://www.docker.com/blog/',
    feedUrl: 'https://www.docker.com/blog/feed/',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['cloud', 'docker', 'containers']
  },
  {
    id: 'hashicorp-blog',
    category: 'cloud-infra-tech',
    name: 'HashiCorp Blog',
    sourceUrl: 'https://www.hashicorp.com/blog',
    feedUrl: 'https://www.hashicorp.com/blog/feed.xml',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'release',
    parserKind: 'feed',
    topicTags: ['cloud', 'terraform', 'iac']
  },
  {
    id: 'github-changelog-actions',
    category: 'cloud-infra-tech',
    name: 'GitHub Changelog',
    sourceUrl: 'https://github.blog/changelog/',
    feedUrl: 'https://github.blog/changelog/feed/',
    sourceType: 'rss',
    authorityTier: 'official-release',
    sourceGroup: 'official',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['cloud', 'github-actions', 'cicd']
  },
  {
    id: 'gitlab-blog-ci',
    category: 'cloud-infra-tech',
    name: 'GitLab CI/CD Blog',
    sourceUrl: 'https://about.gitlab.com/blog/',
    feedUrl: 'https://about.gitlab.com/atom.xml',
    sourceType: 'atom',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['cloud', 'gitlab', 'cicd']
  },
  {
    id: 'aws-compute-blog',
    category: 'cloud-infra-tech',
    name: 'AWS Compute Blog',
    sourceUrl: 'https://aws.amazon.com/blogs/compute/',
    feedUrl: 'https://aws.amazon.com/blogs/compute/feed/',
    sourceType: 'rss',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'docs-update',
    parserKind: 'feed',
    topicTags: ['cloud', 'serverless', 'aws']
  }
];

export const FRONTEND_SECURITY_SOURCES: NvdKeywordSourceRecord[] = [
  {
    id: 'nvd-frontend-ecosystem',
    category: 'frontend-security',
    name: 'NVD Frontend Ecosystem',
    sourceUrl: 'https://nvd.nist.gov/',
    sourceType: 'nvd-api',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    parserKind: 'security-advisory',
    topicTags: ['frontend-security', 'dependency', 'supply-chain'],
    keywords: [
      'axios',
      'vite',
      'webpack',
      'react',
      'vue',
      'next.js',
      'typescript',
      'eslint',
      'npm',
      'pnpm',
      'apifox',
      'node.js',
      'chrome',
      'v8',
      'webassembly'
    ]
  },
  {
    id: 'nvd-general-security',
    category: 'general-security',
    name: 'NVD Infrastructure Security',
    sourceUrl: 'https://nvd.nist.gov/',
    sourceType: 'nvd-api',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    parserKind: 'security-advisory',
    topicTags: ['general-security', 'infra', 'runtime'],
    keywords: ['linux', 'windows', 'macos', 'postgresql', 'mysql', 'redis', 'kubernetes', 'docker', 'terraform']
  }
];

export const FRONTEND_SECURITY_PAGE_SOURCES: SecurityPageSourceRecord[] = [
  {
    id: 'nodejs-security-page',
    category: 'general-security',
    name: 'Node.js Security',
    sourceUrl: 'https://nodejs.org/',
    pageUrl: 'https://nodejs.org/en/blog/vulnerability/april-2026-security-releases',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'nodejs', 'runtime']
  },
  {
    id: 'postgresql-security-page',
    category: 'general-security',
    name: 'PostgreSQL Security',
    sourceUrl: 'https://www.postgresql.org/',
    pageUrl: 'https://www.postgresql.org/support/security/CVE-2026-postgresql-high-risk/',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'postgresql', 'database']
  },
  {
    id: 'redis-security-page',
    category: 'general-security',
    name: 'Redis Security',
    sourceUrl: 'https://redis.io/',
    pageUrl: 'https://redis.io/security/advisories/redis-rce-april-2026/',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'redis', 'database']
  },
  {
    id: 'kubernetes-security-page',
    category: 'general-security',
    name: 'Kubernetes Security',
    sourceUrl: 'https://kubernetes.io/',
    pageUrl: 'https://kubernetes.io/blog/2026/03/31/security-advisory-kubernetes-rbac-bypass/',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'kubernetes', 'rbac']
  },
  {
    id: 'docker-security-page',
    category: 'general-security',
    name: 'Docker Security',
    sourceUrl: 'https://www.docker.com/',
    pageUrl: 'https://www.docker.com/blog/docker-engine-security-bulletin-april-2026/',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'docker', 'container']
  },
  {
    id: 'linux-kernel-security-page',
    category: 'general-security',
    name: 'Linux Kernel Security',
    sourceUrl: 'https://www.kernel.org/',
    pageUrl: 'https://www.kernel.org/pub/linux/kernel/v6.x/ChangeLog-6.14.3',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'linux', 'kernel']
  },
  {
    id: 'microsoft-security-response-center',
    category: 'general-security',
    name: 'Microsoft Security Response Center',
    sourceUrl: 'https://msrc.microsoft.com/',
    pageUrl: 'https://msrc.microsoft.com/update-guide/vulnerability/CVE-2026-windows-privilege-boundary',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'windows', 'privilege']
  },
  {
    id: 'apple-security-updates',
    category: 'general-security',
    name: 'Apple Security Updates',
    sourceUrl: 'https://support.apple.com/',
    pageUrl: 'https://support.apple.com/en-us/122000',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'macos', 'apple']
  },
  {
    id: 'aws-security-bulletins',
    category: 'general-security',
    name: 'AWS Security Bulletins',
    sourceUrl: 'https://aws.amazon.com/security/security-bulletins/',
    pageUrl: 'https://aws.amazon.com/security/security-bulletins/AWS-2026-004/',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['general-security', 'aws', 'cloud']
  },
  {
    id: 'axios-github-advisory',
    category: 'frontend-security',
    name: 'GitHub Advisory / axios',
    sourceUrl: 'https://github.com/advisories',
    pageUrl: 'https://github.com/advisories/GHSA-4hjh-wcwx-xvwj',
    sourceType: 'security-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'github-advisory',
    parserKind: 'security-advisory',
    topicTags: ['frontend-security', 'axios', 'advisory']
  },
  {
    id: 'claude-code-workspace-trust-gitlab',
    category: 'devtool-security',
    name: 'GitLab Advisory / Claude Code',
    sourceUrl: 'https://advisories.gitlab.com/pkg/npm/%40anthropic-ai/claude-code/',
    pageUrl: 'https://advisories.gitlab.com/pkg/npm/%40anthropic-ai/claude-code/CVE-2026-33068/',
    sourceType: 'security-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'gitlab-advisory',
    parserKind: 'security-advisory',
    topicTags: ['devtool-security', 'claude-code', 'advisory']
  },
  {
    id: 'mcp-path-traversal-github-advisory',
    category: 'devtool-security',
    name: 'GitHub Advisory / MCP Server',
    sourceUrl: 'https://github.com/advisories',
    pageUrl: 'https://github.com/advisories/GHSA-mcp-path-traversal-2026',
    sourceType: 'security-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'github-advisory',
    parserKind: 'security-advisory',
    topicTags: ['devtool-security', 'mcp', 'path-traversal']
  },
  {
    id: 'langgraph-checkpointer-security',
    category: 'devtool-security',
    name: 'LangChain Security Blog',
    sourceUrl: 'https://blog.langchain.com/',
    pageUrl: 'https://blog.langchain.com/langgraph-memory-checkpoint-vulnerability',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['devtool-security', 'langgraph', 'checkpointer', 'memory']
  },
  {
    id: 'huggingface-spaces-env-security',
    category: 'devtool-security',
    name: 'Hugging Face Security',
    sourceUrl: 'https://huggingface.co/blog',
    pageUrl: 'https://huggingface.co/blog/spaces-env-exposure-security',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['devtool-security', 'hugging-face', 'spaces', 'env']
  },
  {
    id: 'langsmith-permission-fix',
    category: 'devtool-security',
    name: 'LangSmith Changelog',
    sourceUrl: 'https://docs.smith.langchain.com/changelog',
    pageUrl: 'https://docs.smith.langchain.com/changelog/team-project-permission-fix',
    sourceType: 'official-page',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['devtool-security', 'langsmith', 'permissions']
  },
  {
    id: 'apifox-official-incident',
    category: 'frontend-security',
    name: 'Apifox 官方公告',
    sourceUrl: 'https://apifox.com',
    pageUrl: 'https://docs.apifox.com/8392582m0',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'incident',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['frontend-security', 'apifox', 'cdn']
  },
  {
    id: 'nodejs-security-releases',
    category: 'frontend-security',
    name: 'Node.js Official',
    sourceUrl: 'https://nodejs.org/',
    pageUrl: 'https://nodejs.org/en/blog/vulnerability/march-2026-security-releases',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['frontend-security', 'nodejs', 'runtime', 'ssr']
  },
  {
    id: 'chrome-releases-security',
    category: 'frontend-security',
    name: 'Chrome Releases',
    sourceUrl: 'https://chromereleases.googleblog.com/',
    pageUrl: 'https://chromereleases.googleblog.com/2026/03/stable-channel-update-for-desktop_31.html',
    sourceType: 'official-page',
    authorityTier: 'official-advisory',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['frontend-security', 'chrome', 'browser', 'webgl', 'webcodecs']
  },
  {
    id: 'v8-wasm-security-fix',
    category: 'frontend-security',
    name: 'V8 Dev Blog',
    sourceUrl: 'https://v8.dev/blog',
    pageUrl: 'https://v8.dev/blog/wasm-memory-corruption-fix',
    sourceType: 'official-page',
    authorityTier: 'official-blog',
    sourceGroup: 'official',
    contentKind: 'advisory',
    pageKind: 'incident-page',
    parserKind: 'incident-page',
    topicTags: ['frontend-security', 'v8', 'wasm', 'webassembly']
  },
  {
    id: 'claude-code-source-map-exposure',
    category: 'devtool-security',
    name: 'The Verge / Claude Code 源码泄露',
    sourceUrl: 'https://www.theverge.com/',
    pageUrl: 'https://www.theverge.com/ai-artificial-intelligence/904776/anthropic-claude-source-code-leak',
    sourceType: 'official-page',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'incident',
    pageKind: 'media-incident',
    parserKind: 'media-report',
    topicTags: ['devtool-security', 'claude-code', 'source-map', 'toolchain']
  },
  {
    id: 'axios-datadog-security-labs',
    category: 'frontend-security',
    name: 'Datadog Security Labs / axios',
    sourceUrl: 'https://securitylabs.datadoghq.com/',
    pageUrl: 'https://securitylabs.datadoghq.com/articles/axios-npm-supply-chain-compromise/',
    sourceType: 'security-page',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'incident',
    pageKind: 'media-incident',
    parserKind: 'media-report',
    topicTags: ['frontend-security', 'axios', 'supply-chain']
  },
  {
    id: 'axios-bitdefender-advisory',
    category: 'frontend-security',
    name: 'Bitdefender Technical Advisory / axios',
    sourceUrl: 'https://businessinsights.bitdefender.com/',
    pageUrl:
      'https://businessinsights.bitdefender.com/technical-advisory-axios-npm-supply-chain-attack-cross-platform-rat-deployed-compromised-account',
    sourceType: 'security-page',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'incident',
    pageKind: 'media-incident',
    parserKind: 'media-report',
    topicTags: ['frontend-security', 'axios', 'supply-chain']
  },
  {
    id: 'axios-cn-sec-report',
    category: 'frontend-security',
    name: 'CN-SEC / axios 供应链投毒',
    sourceUrl: 'https://cn-sec.com/',
    pageUrl: 'https://cn-sec.com/archives/5140833.html',
    sourceType: 'security-page',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'incident',
    pageKind: 'media-incident',
    parserKind: 'media-report',
    topicTags: ['frontend-security', 'axios', 'supply-chain']
  },
  {
    id: 'axios-ithome-report',
    category: 'frontend-security',
    name: 'IT之家 / axios 供应链攻击',
    sourceUrl: 'https://www.ithome.com/',
    pageUrl: 'https://finance.sina.com.cn/tech/digi/2026-03-31/doc-inhswicu3324323.shtml',
    sourceType: 'security-page',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'incident',
    pageKind: 'media-incident',
    parserKind: 'media-report',
    topicTags: ['frontend-security', 'axios', 'supply-chain']
  }
];

export const BRIEFING_CATEGORY_TITLES: Record<TechBriefingCategory, string> = {
  'frontend-security': '前端安全情报',
  'general-security': '通用安全情报',
  'devtool-security': 'Agent / DevTool 安全情报',
  'ai-tech': 'AI 新技术情报',
  'frontend-tech': '前端新技术情报',
  'backend-tech': '后端/全栈新技术',
  'cloud-infra-tech': '云原生与基础设施'
};
