import { describe, expect, it } from 'vitest';

import {
  PlatformCommandResolver,
  PosixPlatformCommandProvider,
  RawCommandClassifier,
  WindowsPlatformCommandProvider
} from '../../src/command';

describe('PlatformCommandResolver', () => {
  it('resolves semantic commands for POSIX and Windows providers', () => {
    const resolver = new PlatformCommandResolver({
      providers: [new PosixPlatformCommandProvider(), new WindowsPlatformCommandProvider()]
    });

    expect(resolver.resolve({ commandId: 'list-directory', platform: 'posix', args: ['src'] })).toEqual({
      executable: 'ls',
      args: ['-la', 'src'],
      shell: false
    });
    expect(resolver.resolve({ commandId: 'list-directory', platform: 'windows', args: ['src'] })).toEqual({
      executable: 'cmd.exe',
      args: ['/d', '/s', '/c', 'dir', 'src'],
      shell: false
    });
  });

  it('classifies raw commands without executing them', () => {
    const classifier = new RawCommandClassifier();

    expect(classifier.classify('pnpm test')).toMatchObject({
      intent: 'verification',
      riskClass: 'low',
      isReadOnly: true
    });
    expect(classifier.classify('rm -rf dist')).toMatchObject({
      intent: 'destructive',
      riskClass: 'critical',
      isDestructive: true
    });
  });
});
