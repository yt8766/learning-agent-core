import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(__dirname, '..', 'src');
const FORBIDDEN = ['MockKnowledgeApiClient', 'mock-data', 'mock-knowledge-governance-data', 'VITE_KNOWLEDGE_API_MODE'];

function scanDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

describe('no runtime mock guard', () => {
  it('src/ contains no references to runtime mock client or mock data', () => {
    const files = scanDir(SRC_DIR);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const forbidden of FORBIDDEN) {
        if (content.includes(forbidden)) {
          violations.push(`${relative(SRC_DIR, file)}: ${forbidden}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
