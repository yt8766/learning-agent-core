import type { SkillSourceRecord } from '@agent/core';

export function createInternalSkillSource(): SkillSourceRecord {
  return {
    id: 'source-1',
    name: 'Internal source',
    kind: 'git',
    baseUrl: 'https://example.test/source.git',
    discoveryMode: 'git-registry',
    syncStrategy: 'on-demand',
    allowedProfiles: ['platform'],
    trustClass: 'internal',
    priority: 'bundled/marketplace',
    authMode: 'none',
    enabled: true
  };
}

export function createDirectorySource(trustClass: SkillSourceRecord['trustClass'] = 'internal'): SkillSourceRecord {
  return {
    id: 'skills-sh-directory',
    name: 'skills.sh Directory',
    kind: 'git',
    baseUrl: 'https://skills.sh',
    discoveryMode: 'git-registry',
    syncStrategy: 'on-demand',
    allowedProfiles: ['platform'],
    trustClass,
    priority: 'bundled/marketplace',
    authMode: 'none',
    enabled: true
  };
}
