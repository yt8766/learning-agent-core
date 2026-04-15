import type { FeedSourceRecord } from './runtime-tech-briefing-sources';

export const BACKEND_FEED_SOURCES: FeedSourceRecord[] = [
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
  }
];
