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
        return {
          outputSummary: `Browser automation simulated visit to ${url} for "${goal}"`,
          rawOutput: { url, goal, simulated: true }
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
