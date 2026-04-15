import type { NvdKeywordSourceRecord } from './runtime-tech-briefing-sources';

export const FRONTEND_SECURITY_SOURCES_DATA: NvdKeywordSourceRecord[] = [
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
