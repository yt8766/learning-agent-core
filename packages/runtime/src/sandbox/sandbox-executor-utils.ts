import { readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

export function toWorkspacePath(inputPath: unknown): string {
  const workspaceRoot = process.cwd();
  const candidate = typeof inputPath === 'string' && inputPath.trim().length > 0 ? inputPath : 'package.json';
  const resolved = resolve(workspaceRoot, candidate);
  const relativePath = relative(workspaceRoot, resolved);

  if (relativePath.startsWith('..') || relativePath.includes(`..${sep}`)) {
    throw new Error('Access outside the workspace is not allowed.');
  }

  return resolved;
}

export async function collectFiles(rootPath: string, matcher: (path: string) => boolean): Promise<string[]> {
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

export function tokenize(text: string): string[] {
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

export function scoreMatch(goal: string, text: string): number {
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
