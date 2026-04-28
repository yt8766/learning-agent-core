import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative } from 'node:path';

import type { ToolExecutionRequest } from '@agent/runtime';

import { collectFiles, toWorkspacePath } from '@agent/runtime';

export async function executeFilesystemTool(request: ToolExecutionRequest) {
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
    case 'delete_local_file': {
      const filePath = toWorkspacePath(request.input.path ?? 'data/output.txt');
      const recursive = request.input.recursive === true;
      const targetStat = await stat(filePath);
      await rm(filePath, { recursive, force: false });
      return {
        outputSummary: `Deleted ${targetStat.isDirectory() ? 'directory' : 'file'} ${relative(process.cwd(), filePath)}`,
        rawOutput: { path: filePath, kind: targetStat.isDirectory() ? 'directory' : 'file', recursive }
      };
    }
    case 'move_local_file': {
      const fromPath = toWorkspacePath(request.input.fromPath);
      const toPath = toWorkspacePath(request.input.toPath);
      await mkdir(dirname(toPath), { recursive: true });
      await rename(fromPath, toPath);
      return {
        outputSummary: `Moved ${relative(process.cwd(), fromPath)} to ${relative(process.cwd(), toPath)}`,
        rawOutput: { fromPath, toPath }
      };
    }
    case 'copy_local_file': {
      const fromPath = toWorkspacePath(request.input.fromPath);
      const toPath = toWorkspacePath(request.input.toPath);
      await mkdir(dirname(toPath), { recursive: true });
      await cp(fromPath, toPath, { force: true, recursive: false });
      return {
        outputSummary: `Copied ${relative(process.cwd(), fromPath)} to ${relative(process.cwd(), toPath)}`,
        rawOutput: { fromPath, toPath }
      };
    }
    case 'patch_local_file': {
      const filePath = toWorkspacePath(request.input.path);
      const search = String(request.input.search ?? '');
      const replace = String(request.input.replace ?? '');
      const replaceAll = request.input.all === true;
      const content = await readFile(filePath, 'utf8');
      if (!search) {
        throw new Error('patch_local_file requires a non-empty search string.');
      }
      if (!content.includes(search)) {
        throw new Error(`Search text not found in ${relative(process.cwd(), filePath)}.`);
      }
      const nextContent = replaceAll ? content.split(search).join(replace) : content.replace(search, replace);
      await writeFile(filePath, nextContent);
      const replacements = replaceAll ? content.split(search).length - 1 : 1;
      return {
        outputSummary: `Patched ${relative(process.cwd(), filePath)} (${replacements} replacement${replacements > 1 ? 's' : ''})`,
        rawOutput: { path: filePath, replacements }
      };
    }
    case 'glob_workspace': {
      const basePath = toWorkspacePath(request.input.basePath ?? '.');
      const pattern = String(request.input.pattern ?? '**/*');
      const limit = toLimit(request.input.limit, 100);
      const files = await collectFiles(basePath, filePath => matchesGlobish(relative(basePath, filePath), pattern));
      return {
        outputSummary: `Matched ${Math.min(files.length, limit)} files for ${pattern}`,
        rawOutput: {
          basePath,
          pattern,
          items: files.slice(0, limit).map(filePath => relative(process.cwd(), filePath))
        }
      };
    }
    case 'search_in_files': {
      const basePath = toWorkspacePath(request.input.basePath ?? '.');
      const query = String(request.input.query ?? '');
      const filePattern = String(request.input.filePattern ?? '**/*');
      const limit = toLimit(request.input.limit, 50);
      if (!query.trim()) {
        throw new Error('search_in_files requires a non-empty query.');
      }
      const files = await collectFiles(basePath, filePath => matchesGlobish(relative(basePath, filePath), filePattern));
      const matches: Array<{ path: string; line: number; preview: string }> = [];
      for (const filePath of files) {
        if (matches.length >= limit) {
          break;
        }
        const content = await safeReadUtf8(filePath);
        if (!content) {
          continue;
        }
        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
          if (matches.length >= limit) {
            return;
          }
          if (line.toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              path: relative(process.cwd(), filePath),
              line: index + 1,
              preview: line.trim().slice(0, 240)
            });
          }
        });
      }
      return {
        outputSummary: `Found ${matches.length} matches for "${query}"`,
        rawOutput: { basePath, query, filePattern, matches }
      };
    }
    case 'read_json': {
      const filePath = toWorkspacePath(request.input.path);
      const raw = await readFile(filePath, 'utf8');
      const value = JSON.parse(raw) as unknown;
      return {
        outputSummary: `Read JSON ${relative(process.cwd(), filePath)}`,
        rawOutput: { path: filePath, value }
      };
    }
    case 'write_json': {
      const filePath = toWorkspacePath(request.input.path ?? 'data/output.json');
      const spacing = typeof request.input.spacing === 'number' ? request.input.spacing : 2;
      const content = JSON.stringify(request.input.value ?? {}, null, spacing);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${content}\n`);
      return {
        outputSummary: `Wrote JSON ${relative(process.cwd(), filePath)}`,
        rawOutput: { path: filePath, bytes: content.length }
      };
    }
    default:
      return undefined;
  }
}

function toLimit(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.min(Math.floor(value), 500);
  }
  return fallback;
}

function matchesGlobish(candidate: string, pattern: string) {
  const normalizedCandidate = candidate.split('\\').join('/');
  const normalizedPattern = pattern.split('\\').join('/');
  if (normalizedPattern === '**/*' || normalizedPattern === '*') {
    return true;
  }
  const escaped = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `^${escaped.split('**/').join('(?:.+/)?').split('**').join('.*').split('*').join('[^/]*').split('?').join('.')}$`
  );
  return regex.test(normalizedCandidate) || basename(normalizedCandidate).match(regex) !== null;
}

async function safeReadUtf8(filePath: string) {
  try {
    const content = await readFile(filePath, 'utf8');
    if (content.includes('\u0000')) {
      return '';
    }
    return content;
  } catch {
    return '';
  }
}
