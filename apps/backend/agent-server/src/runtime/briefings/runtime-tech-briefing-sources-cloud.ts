import type { FeedSourceRecord } from './runtime-tech-briefing-sources';

export const CLOUD_INFRA_FEED_SOURCES: FeedSourceRecord[] = [
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
