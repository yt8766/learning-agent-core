import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ToolExecutionRequest } from '../contracts/governance';

import { toWorkspacePath } from './sandbox-executor-utils';

type BrowserReplayArtifactKind = 'browser_replay' | 'browser_snapshot' | 'browser_screenshot';

export interface BrowserReplayArtifactEntry {
  kind: BrowserReplayArtifactKind;
  sessionId: string;
  fileName: string;
  content: string;
  contentType: string;
}

export interface BrowserReplayArtifactReference {
  artifactId: string;
  artifactUrl: string;
}

export interface BrowserReplayArtifactWriter {
  writeReplayArtifact(entry: BrowserReplayArtifactEntry): Promise<BrowserReplayArtifactReference>;
}

export interface ExecuteBrowsePageOptions {
  artifactWriter?: BrowserReplayArtifactWriter;
  now?: () => Date;
  sessionIdFactory?: () => string;
}

interface BrowserReplayReferences {
  artifactId?: string;
  artifactUrl?: string;
  artifactRef: string;
  snapshotArtifactId?: string;
  snapshotRef: string;
  screenshotArtifactId?: string;
  screenshotRef: string;
}

interface BrowserReplayAssetReferences {
  snapshotArtifactId?: string;
  snapshotRef: string;
  screenshotArtifactId?: string;
  screenshotRef: string;
}

export async function executeBrowsePage(request: ToolExecutionRequest, options: ExecuteBrowsePageOptions = {}) {
  const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
  const url = typeof request.input.url === 'string' ? request.input.url : 'http://localhost:3000';
  const now = options.now ?? (() => new Date());
  const createdAt = now().toISOString();
  const sessionId = options.sessionIdFactory?.() ?? `browser_${Date.now()}`;
  const replayArtifactDir = `artifacts/runtime/browser-replays/${sessionId}`;
  const replayDir = toWorkspacePath(replayArtifactDir);
  const artifactPath = resolve(replayDir, 'replay.json');
  const snapshotPath = resolve(replayDir, 'snapshot.html');
  const screenshotPath = resolve(replayDir, 'screenshot.txt');
  const snapshotContent = `<!doctype html><html><body><h1>Replay Snapshot</h1><p>URL: ${url}</p><p>Goal: ${goal}</p></body></html>`;
  const screenshotContent = `Replay screenshot placeholder for ${url}\nGenerated at ${createdAt}\nGoal: ${goal}\n`;
  const assetReferences = await writeBrowserReplayAssets({
    artifactWriter: options.artifactWriter,
    sessionId,
    legacyPaths: {
      replayDir,
      snapshotPath,
      screenshotPath,
      snapshotRef: `${replayArtifactDir}/snapshot.html`,
      screenshotRef: `${replayArtifactDir}/screenshot.txt`
    },
    snapshotContent,
    screenshotContent
  });
  const steps = [
    {
      id: 'open_page',
      title: 'Open page',
      status: 'completed' as const,
      at: createdAt,
      summary: `Opened ${url}`,
      artifactRef: assetReferences.snapshotRef
    },
    {
      id: 'wait_for_ready',
      title: 'Wait for ready',
      status: 'completed' as const,
      at: createdAt,
      summary: 'Document readyState reached complete'
    },
    {
      id: 'capture_snapshot',
      title: 'Capture snapshot',
      status: 'completed' as const,
      at: createdAt,
      summary: 'Captured DOM snapshot and screenshot placeholder',
      artifactRef: assetReferences.screenshotRef
    },
    {
      id: 'collect_dom_summary',
      title: 'Collect DOM summary',
      status: 'completed' as const,
      at: createdAt,
      summary: `Prepared page summary for "${goal}"`
    }
  ];
  const replayArtifact = {
    sessionId,
    url,
    goal,
    createdAt,
    simulated: true,
    snapshotSummary: `已完成对 ${url} 的模拟浏览，并生成页面快照摘要。`,
    snapshotRef: assetReferences.snapshotRef,
    screenshotRef: assetReferences.screenshotRef,
    stepTrace: steps.map(step => step.id),
    steps
  };
  const replayReference = await writeBrowserReplayArtifact({
    artifactWriter: options.artifactWriter,
    sessionId,
    legacyPaths: {
      artifactPath,
      artifactRef: `${replayArtifactDir}/replay.json`
    },
    replayContent: JSON.stringify(replayArtifact, null, 2)
  });
  const references = {
    ...assetReferences,
    ...replayReference
  };
  return {
    outputSummary: `Browser automation simulated visit to ${url} for "${goal}"`,
    rawOutput: {
      url,
      goal,
      simulated: true,
      sessionId,
      snapshotSummary: replayArtifact.snapshotSummary,
      artifactId: references.artifactId,
      artifactUrl: references.artifactUrl,
      artifactRef: references.artifactRef,
      snapshotArtifactId: references.snapshotArtifactId,
      snapshotRef: references.snapshotRef,
      screenshotArtifactId: references.screenshotArtifactId,
      screenshotRef: references.screenshotRef,
      screenshot: {
        path: references.screenshotRef,
        artifactId: references.screenshotArtifactId,
        url: references.screenshotRef,
        simulated: true,
        placeholder: true,
        kind: 'text_placeholder'
      },
      stepTrace: replayArtifact.stepTrace,
      steps
    }
  };
}

async function writeBrowserReplayAssets(input: {
  artifactWriter?: BrowserReplayArtifactWriter;
  sessionId: string;
  legacyPaths: {
    replayDir: string;
    snapshotPath: string;
    screenshotPath: string;
    snapshotRef: string;
    screenshotRef: string;
  };
  snapshotContent: string;
  screenshotContent: string;
}): Promise<BrowserReplayAssetReferences> {
  if (input.artifactWriter) {
    const snapshot = await input.artifactWriter.writeReplayArtifact({
      kind: 'browser_snapshot',
      sessionId: input.sessionId,
      fileName: 'snapshot.html',
      content: input.snapshotContent,
      contentType: 'text/html'
    });
    const screenshot = await input.artifactWriter.writeReplayArtifact({
      kind: 'browser_screenshot',
      sessionId: input.sessionId,
      fileName: 'screenshot.txt',
      content: input.screenshotContent,
      contentType: 'text/plain'
    });

    return {
      snapshotArtifactId: snapshot.artifactId,
      snapshotRef: snapshot.artifactUrl,
      screenshotArtifactId: screenshot.artifactId,
      screenshotRef: screenshot.artifactUrl
    };
  }

  await mkdir(input.legacyPaths.replayDir, { recursive: true });
  await writeFile(input.legacyPaths.snapshotPath, input.snapshotContent);
  await writeFile(input.legacyPaths.screenshotPath, input.screenshotContent);

  return {
    snapshotRef: input.legacyPaths.snapshotRef,
    screenshotRef: input.legacyPaths.screenshotRef
  };
}

async function writeBrowserReplayArtifact(input: {
  artifactWriter?: BrowserReplayArtifactWriter;
  sessionId: string;
  legacyPaths: {
    artifactPath: string;
    artifactRef: string;
  };
  replayContent: string;
}): Promise<Pick<BrowserReplayReferences, 'artifactId' | 'artifactUrl' | 'artifactRef'>> {
  if (input.artifactWriter) {
    const replay = await input.artifactWriter.writeReplayArtifact({
      kind: 'browser_replay',
      sessionId: input.sessionId,
      fileName: 'replay.json',
      content: input.replayContent,
      contentType: 'application/json'
    });

    return {
      artifactId: replay.artifactId,
      artifactUrl: replay.artifactUrl,
      artifactRef: replay.artifactUrl
    };
  }

  await writeFile(input.legacyPaths.artifactPath, input.replayContent);

  return {
    artifactRef: input.legacyPaths.artifactRef
  };
}
