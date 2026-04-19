import { describe, expect, it } from 'vitest';

import {
  findInstallableManifestSuggestion,
  shouldAutoInstallManifest
} from '../../../../src/runtime/domain/skills/runtime-skill-auto-install';

describe('runtime skill auto install', () => {
  it('finds only manifest suggestions that are actually installable', () => {
    expect(
      findInstallableManifestSuggestion([
        { id: 'ready', kind: 'installed', availability: 'ready' },
        { id: 'blocked', kind: 'manifest', availability: 'approval-required' },
        { id: 'ok', kind: 'manifest', availability: 'installable-local' }
      ] as any)
    ).toEqual(
      expect.objectContaining({
        id: 'ok',
        kind: 'manifest',
        availability: 'installable-local'
      })
    );
  });

  it('allows auto install only for high-trust, low-risk manifests with complete declarations', () => {
    expect(
      shouldAutoInstallManifest({
        manifest: {
          id: 'manifest-ok',
          license: 'MIT'
        } as any,
        safety: {
          verdict: 'allow',
          trustScore: 88,
          sourceTrustClass: 'official'
        } as any
      })
    ).toBe(true);

    expect(
      shouldAutoInstallManifest({
        manifest: {
          id: 'manifest-low-trust',
          license: 'MIT'
        } as any,
        safety: {
          verdict: 'allow',
          trustScore: 70,
          sourceTrustClass: 'official'
        } as any
      })
    ).toBe(false);

    expect(
      shouldAutoInstallManifest({
        manifest: {
          id: 'manifest-missing-license'
        } as any,
        safety: {
          verdict: 'allow',
          trustScore: 95,
          sourceTrustClass: 'curated'
        } as any
      })
    ).toBe(false);

    expect(
      shouldAutoInstallManifest({
        manifest: {
          id: 'manifest-community',
          license: 'MIT'
        } as any,
        safety: {
          verdict: 'allow',
          trustScore: 95,
          sourceTrustClass: 'community'
        } as any
      })
    ).toBe(false);
  });
});
