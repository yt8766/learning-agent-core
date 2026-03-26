import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import { ToolExecutionRequest, ToolExecutionResult } from '@agent/shared';

export interface SandboxExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

function toWorkspacePath(inputPath: unknown): string {
  const workspaceRoot = process.cwd();
  const candidate = typeof inputPath === 'string' && inputPath.trim().length > 0 ? inputPath : 'package.json';
  const resolved = resolve(workspaceRoot, candidate);
  const relativePath = relative(workspaceRoot, resolved);

  if (relativePath.startsWith('..') || relativePath.includes(`..${sep}`)) {
    throw new Error('Access outside the workspace is not allowed.');
  }

  return resolved;
}

async function collectFiles(rootPath: string, matcher: (path: string) => boolean): Promise<string[]> {
  const results: string[] = [];
  const stack = [rootPath];
  while (stack.length) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const nextPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (matcher(nextPath)) {
        results.push(nextPath);
      }
    }
  }
  return results;
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}_-]+/u)
        .map(token => token.trim())
        .filter(token => token.length >= 2)
    )
  );
}

function scoreMatch(goal: string, text: string): number {
  const queryTokens = tokenize(goal);
  const documentTokens = new Set(tokenize(text));
  if (!queryTokens.length || !documentTokens.size) {
    return 0;
  }
  let matches = 0;
  for (const token of queryTokens) {
    if (documentTokens.has(token)) {
      matches += 1;
    }
  }
  return matches / queryTokens.length;
}

export class LocalSandboxExecutor implements SandboxExecutor {
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startedAt = Date.now();

    try {
      const result = await this.executeInternal(request);
      return {
        ok: true,
        outputSummary: result.outputSummary,
        rawOutput: result.rawOutput,
        exitCode: 0,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        ok: false,
        outputSummary: 'Sandbox execution failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown sandbox error',
        exitCode: 1,
        durationMs: Date.now() - startedAt
      };
    }
  }

  private async executeInternal(request: ToolExecutionRequest): Promise<{ outputSummary: string; rawOutput: unknown }> {
    switch (request.toolName) {
      case 'read_local_file': {
        const filePath = toWorkspacePath(request.input.path);
        const content = await readFile(filePath, 'utf8');
        return {
          outputSummary: `Read ${relative(process.cwd(), filePath)} (${content.length} chars)`,
          rawOutput: { path: filePath, content }
        };
      }
      case 'list_directory': {
        const targetPath = toWorkspacePath(request.input.path ?? '.');
        const entries = await readdir(targetPath, { withFileTypes: true });
        const items = entries.map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'dir' : 'file'
        }));
        return {
          outputSummary: `Listed ${items.length} entries in ${relative(process.cwd(), targetPath) || '.'}`,
          rawOutput: { path: targetPath, items }
        };
      }
      case 'write_local_file': {
        const filePath = toWorkspacePath(request.input.path ?? 'data/output.txt');
        const content =
          typeof request.input.content === 'string' ? request.input.content : JSON.stringify(request.input, null, 2);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content);
        return {
          outputSummary: `Wrote ${content.length} chars to ${relative(process.cwd(), filePath)}`,
          rawOutput: { path: filePath, bytes: content.length }
        };
      }
      case 'http_request': {
        return {
          outputSummary:
            'HTTP requests remain disabled in the local sandbox. Use this as an approval placeholder only.',
          rawOutput: { blocked: true, reason: 'network_restricted', request: request.input }
        };
      }
      case 'local-analysis': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const researchSummary =
          typeof request.input.researchSummary === 'string' ? request.input.researchSummary : 'no research summary';
        return {
          outputSummary: `Local analysis reviewed goal "${goal}" using summary: ${researchSummary}`,
          rawOutput: { goal, researchSummary }
        };
      }
      case 'find-skills': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const limit = typeof request.input.limit === 'number' ? request.input.limit : 8;
        const workspaceRoot = process.cwd();
        const installedMetadataFiles = await collectFiles(
          resolve(workspaceRoot, 'data', 'skills', 'installed'),
          filePath => filePath.endsWith('.json')
        );
        const localSkillFiles = await collectFiles(resolve(workspaceRoot, 'skills'), filePath =>
          filePath.endsWith('SKILL.md')
        );
        const remoteIndexFiles = await collectFiles(
          resolve(workspaceRoot, 'data', 'skills', 'remote-sources'),
          filePath => filePath.endsWith('index.json')
        );

        const installed = [];
        for (const filePath of installedMetadataFiles) {
          try {
            const raw = await readFile(filePath, 'utf8');
            const payload = JSON.parse(raw) as {
              manifest?: {
                id?: string;
                name?: string;
                description?: string;
                summary?: string;
                version?: string;
                sourceId?: string;
              };
            };
            const manifest = payload.manifest;
            if (!manifest?.id) {
              continue;
            }
            installed.push({
              id: manifest.id,
              displayName: manifest.name ?? manifest.id,
              kind: 'installed',
              version: manifest.version,
              sourceId: manifest.sourceId,
              path: relative(workspaceRoot, filePath),
              score: scoreMatch(
                goal,
                [manifest.id, manifest.name, manifest.description, manifest.summary].filter(Boolean).join(' ')
              )
            });
          } catch {
            continue;
          }
        }

        const local = [];
        for (const filePath of localSkillFiles) {
          try {
            const raw = await readFile(filePath, 'utf8');
            const firstHeading = raw
              .split('\n')
              .find(line => line.trim().startsWith('#'))
              ?.replace(/^#+\s*/, '')
              .trim();
            local.push({
              id: relative(resolve(workspaceRoot, 'skills'), dirname(filePath)),
              displayName: firstHeading || relative(workspaceRoot, dirname(filePath)),
              kind: 'local-manifest',
              path: relative(workspaceRoot, filePath),
              score: scoreMatch(goal, `${firstHeading ?? ''} ${raw.slice(0, 400)}`)
            });
          } catch {
            continue;
          }
        }

        const remote = [];
        for (const filePath of remoteIndexFiles) {
          try {
            const raw = await readFile(filePath, 'utf8');
            const payload = JSON.parse(raw) as {
              manifests?: Array<{
                id?: string;
                name?: string;
                description?: string;
                summary?: string;
                version?: string;
                sourceId?: string;
                artifactUrl?: string;
              }>;
            };
            for (const manifest of payload.manifests ?? []) {
              if (!manifest.id) {
                continue;
              }
              remote.push({
                id: manifest.id,
                displayName: manifest.name ?? manifest.id,
                kind: 'remote-manifest',
                version: manifest.version,
                sourceId: manifest.sourceId,
                artifactUrl: manifest.artifactUrl,
                path: relative(workspaceRoot, filePath),
                score: scoreMatch(
                  goal,
                  [manifest.id, manifest.name, manifest.description, manifest.summary].filter(Boolean).join(' ')
                )
              });
            }
          } catch {
            continue;
          }
        }

        const suggestions = [...installed, ...local, ...remote]
          .filter(item => item.score > 0)
          .sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))
          .slice(0, limit);

        return {
          outputSummary: suggestions.length
            ? `Found ${suggestions.length} local skill matches for "${goal}"`
            : `No local skill matches found for "${goal}"`,
          rawOutput: {
            goal,
            suggestions,
            scanned: {
              installedMetadataFiles: installedMetadataFiles.length,
              localSkillFiles: localSkillFiles.length,
              remoteIndexFiles: remoteIndexFiles.length
            }
          }
        };
      }
      case 'collect_research_source': {
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown goal';
        const url = typeof request.input.url === 'string' ? request.input.url : 'https://example.com/';
        const trustClass = typeof request.input.trustClass === 'string' ? request.input.trustClass : 'official';
        const sourceType =
          typeof request.input.sourceType === 'string' ? request.input.sourceType : 'web_research_plan';
        const host = new URL(url).host;
        return {
          outputSummary: `Collected research summary from ${host} for "${goal}"`,
          rawOutput: {
            url,
            host,
            goal,
            trustClass,
            sourceType,
            fetchedAt: new Date().toISOString(),
            summary: `已从 ${host} 抓取与“${goal}”相关的结构化摘要，适合作为后续研究与学习沉淀的依据。`,
            simulated: true
          }
        };
      }
      case 'browse_page': {
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
            stepTrace: replayArtifact.stepTrace,
            steps
          }
        };
      }
      case 'run_terminal': {
        const command = typeof request.input.command === 'string' ? request.input.command : 'pnpm test -- --help';
        return {
          outputSummary: `Terminal MCP simulated command: ${command}`,
          rawOutput: { command, simulated: true }
        };
      }
      case 'ship_release': {
        const target = typeof request.input.target === 'string' ? request.input.target : 'main';
        const goal = typeof request.input.goal === 'string' ? request.input.goal : 'unknown release goal';
        return {
          outputSummary: `Release MCP simulated shipping target "${target}" for "${goal}"`,
          rawOutput: { target, goal, simulated: true }
        };
      }
      default: {
        return {
          outputSummary: `Sandbox stub executed ${request.toolName}`,
          rawOutput: {
            intent: request.intent,
            input: request.input
          }
        };
      }
    }
  }
}

export class StubSandboxExecutor extends LocalSandboxExecutor {}
