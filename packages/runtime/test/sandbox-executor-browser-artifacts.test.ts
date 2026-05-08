import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LocalSandboxExecutor } from '../src/sandbox/sandbox-executor';
import { executeBrowsePage, type BrowserReplayArtifactWriter } from '../src/sandbox/sandbox-executor-browser';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('sandbox browser artifact writing', () => {
  it('uses an injected artifact writer and returns stable artifact references without writing root browser-replays', async () => {
    const writes: Array<{ kind: string; fileName: string; content: string }> = [];
    const writer: BrowserReplayArtifactWriter = {
      async writeReplayArtifact(entry) {
        writes.push(entry);
        return {
          artifactId: `artifact-browser-${entry.kind}`,
          artifactUrl: `artifact://browser/${entry.fileName}`
        };
      }
    };

    const result = await executeBrowsePage(
      {
        toolName: 'browse_page',
        intent: 'call_external_api',
        input: {
          url: 'http://localhost:4173/dashboard',
          goal: 'capture dashboard state'
        }
      },
      {
        artifactWriter: writer,
        now: () => new Date('2026-05-08T00:00:00.000Z'),
        sessionIdFactory: () => 'browser_stable'
      }
    );

    expect(writes.map(write => write.fileName)).toEqual(['snapshot.html', 'screenshot.txt', 'replay.json']);
    expect(writes.map(write => write.kind)).toEqual(['browser_snapshot', 'browser_screenshot', 'browser_replay']);
    const replayContent = JSON.parse(writes[2]?.content ?? '{}') as {
      snapshotRef?: string;
      screenshotRef?: string;
      steps?: Array<{ artifactRef?: string }>;
    };
    expect(replayContent.snapshotRef).toBe('artifact://browser/snapshot.html');
    expect(replayContent.screenshotRef).toBe('artifact://browser/screenshot.txt');
    expect(replayContent.steps?.map(step => step.artifactRef).filter(Boolean)).toEqual([
      'artifact://browser/snapshot.html',
      'artifact://browser/screenshot.txt'
    ]);
    expect(writes[2]?.content).not.toContain('data/browser-replays');
    expect(result.rawOutput).toMatchObject({
      sessionId: 'browser_stable',
      artifactId: 'artifact-browser-browser_replay',
      artifactUrl: 'artifact://browser/replay.json',
      artifactRef: 'artifact://browser/replay.json',
      snapshotRef: 'artifact://browser/snapshot.html',
      screenshotRef: 'artifact://browser/screenshot.txt',
      screenshot: {
        artifactId: 'artifact-browser-browser_screenshot',
        url: 'artifact://browser/screenshot.txt'
      }
    });
    expect(await pathExists(resolve(process.cwd(), 'data/browser-replays/browser_stable'))).toBe(false);
  });

  it('passes an injected artifact writer through the local sandbox executor browser tool path', async () => {
    const writer: BrowserReplayArtifactWriter = {
      async writeReplayArtifact(entry) {
        return {
          artifactId: `executor-${entry.kind}`,
          artifactUrl: `artifact://executor/${entry.fileName}`
        };
      }
    };
    const executor = new LocalSandboxExecutor({
      browserArtifactWriter: writer,
      now: () => new Date('2026-05-08T00:00:00.000Z'),
      browserSessionIdFactory: () => 'browser_executor'
    });

    const result = await executor.execute({
      toolName: 'browse_page',
      intent: 'call_external_api',
      input: {
        url: 'http://localhost:4173/settings',
        goal: 'capture settings'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toMatchObject({
      artifactId: 'executor-browser_replay',
      artifactUrl: 'artifact://executor/replay.json',
      snapshotRef: 'artifact://executor/snapshot.html',
      screenshotRef: 'artifact://executor/screenshot.txt'
    });
    expect(await pathExists(resolve(process.cwd(), 'data/browser-replays/browser_executor'))).toBe(false);
  });
});
