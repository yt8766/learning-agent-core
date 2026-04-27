import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ToolExecutionRequest } from '@agent/core';

import { toWorkspacePath } from './sandbox-executor-utils';

export async function executeBrowsePage(request: ToolExecutionRequest) {
  const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
  const url = typeof request.input.url === 'string' ? request.input.url : 'http://localhost:3000';
  const createdAt = new Date().toISOString();
  const sessionId = `browser_${Date.now()}`;
  const replayDir = toWorkspacePath(`data/browser-replays/${sessionId}`);
  const artifactPath = resolve(replayDir, 'replay.json');
  const snapshotPath = resolve(replayDir, 'snapshot.html');
  const screenshotPath = resolve(replayDir, 'screenshot.txt');
  const steps = [
    {
      id: 'open_page',
      title: 'Open page',
      status: 'completed' as const,
      at: createdAt,
      summary: `Opened ${url}`,
      artifactRef: snapshotPath
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
      artifactRef: screenshotPath
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
    snapshotRef: snapshotPath,
    screenshotRef: screenshotPath,
    stepTrace: steps.map(step => step.id),
    steps
  };
  await mkdir(replayDir, { recursive: true });
  await writeFile(
    snapshotPath,
    `<!doctype html><html><body><h1>Replay Snapshot</h1><p>URL: ${url}</p><p>Goal: ${goal}</p></body></html>`
  );
  await writeFile(
    screenshotPath,
    `Replay screenshot placeholder for ${url}\nGenerated at ${createdAt}\nGoal: ${goal}\n`
  );
  await writeFile(artifactPath, JSON.stringify(replayArtifact, null, 2));
  return {
    outputSummary: `Browser automation simulated visit to ${url} for "${goal}"`,
    rawOutput: {
      url,
      goal,
      simulated: true,
      sessionId,
      snapshotSummary: replayArtifact.snapshotSummary,
      artifactRef: artifactPath,
      snapshotRef: snapshotPath,
      screenshotRef: screenshotPath,
      screenshot: {
        path: screenshotPath,
        simulated: true,
        placeholder: true,
        kind: 'text_placeholder'
      },
      stepTrace: replayArtifact.stepTrace,
      steps
    }
  };
}
