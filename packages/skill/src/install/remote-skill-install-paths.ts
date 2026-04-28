import { join } from 'node:path';

export function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

export function normalizeOptionalSkillName(value?: string) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function deriveRemoteSkillDisplayName(repo: string) {
  return repo
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\/+$/, '');
}

export function buildRemoteSkillInstallLocation(input: {
  skillPackagesRoot: string;
  repo: string;
  resolvedSkillName: string;
  version: string;
}) {
  return join(
    input.skillPackagesRoot,
    'third-party',
    sanitizePathSegment(input.repo),
    sanitizePathSegment(input.resolvedSkillName),
    input.version
  );
}
