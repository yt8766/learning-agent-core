import { describe, expect, it } from 'vitest';

import {
  buildRemoteSkillInstallLocation,
  deriveRemoteSkillDisplayName,
  normalizeOptionalSkillName,
  sanitizePathSegment
} from '../../../../src/runtime/domain/skills/runtime-skill-install-paths';

describe('runtime skill install paths', () => {
  it('normalizes optional skill names and derives remote display names', () => {
    expect(normalizeOptionalSkillName(undefined)).toBeUndefined();
    expect(normalizeOptionalSkillName('   ')).toBeUndefined();
    expect(normalizeOptionalSkillName('  my-skill  ')).toBe('my-skill');
    expect(deriveRemoteSkillDisplayName('https://github.com/owner/repo/')).toBe('owner/repo');
  });

  it('sanitizes path segments and builds remote install locations deterministically', () => {
    expect(sanitizePathSegment('owner/repo with spaces')).toBe('owner-repo-with-spaces');
    expect(
      buildRemoteSkillInstallLocation({
        skillPackagesRoot: '/tmp/packages',
        repo: 'owner/repo with spaces',
        resolvedSkillName: 'skill/name',
        version: 'remote'
      })
    ).toBe('/tmp/packages/third-party/owner-repo-with-spaces/skill-name/remote');
  });
});
