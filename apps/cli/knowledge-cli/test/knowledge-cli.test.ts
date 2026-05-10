import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { runKnowledgeCli } from '../src/cli';

describe('knowledge-cli', () => {
  it('indexes local markdown files into a reusable snapshot', async () => {
    const workspace = await createFixtureWorkspace();
    const indexFile = join(workspace, '.artifacts', 'index-snapshot.json');

    const result = await runKnowledgeCli(['index', '--dir', workspace, '--indexFile', indexFile]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Indexed 2 documents');
    const snapshot = JSON.parse(await readFile(indexFile, 'utf8'));
    expect(snapshot.documents).toHaveLength(2);
    expect(snapshot.chunks.length).toBeGreaterThan(1);

    await rm(workspace, { recursive: true, force: true });
  });

  it('supports pnpm script argument separator before command', async () => {
    const workspace = await createFixtureWorkspace();
    const indexFile = join(workspace, '.artifacts', 'index-snapshot.json');

    const result = await runKnowledgeCli(['--', 'index', '--dir', workspace, '--indexFile', indexFile]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Indexed 2 documents');
    const snapshot = JSON.parse(await readFile(indexFile, 'utf8'));
    expect(snapshot.documents).toHaveLength(2);

    await rm(workspace, { recursive: true, force: true });
  });

  it('retrieves matching chunks from an index snapshot', async () => {
    const workspace = await createFixtureWorkspace();
    const indexFile = join(workspace, '.artifacts', 'index-snapshot.json');
    await runKnowledgeCli(['index', '--dir', workspace, '--indexFile', indexFile]);

    const result = await runKnowledgeCli([
      'retrieval',
      '--indexFile',
      indexFile,
      '--query',
      'How does the runtime emit trace events?',
      '--topK',
      '2'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Top 2 retrieval hits');
    expect(result.stdout).toContain('trace events');

    await rm(workspace, { recursive: true, force: true });
  });

  it('answers from local documents and writes a JSONL trace', async () => {
    const workspace = await createFixtureWorkspace();
    const traceFile = join(workspace, '.artifacts', 'ask-trace.jsonl');

    const result = await runKnowledgeCli([
      'ask',
      '--dir',
      workspace,
      '--query',
      'What does the RAG runtime do?',
      '--traceFile',
      traceFile,
      '--debug'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Answer');
    expect(result.stdout).toContain('runtime coordinates');
    expect(result.stdout).toContain('Debug hits');
    const trace = await readFile(traceFile, 'utf8');
    expect(trace).toContain('"stage":"index"');
    expect(trace).toContain('"stage":"retrieval"');
    expect(trace).toContain('"stage":"answer"');

    await rm(workspace, { recursive: true, force: true });
  });
});

async function createFixtureWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'knowledge-cli-'));
  await writeFile(
    join(workspace, 'runtime.md'),
    [
      '# Runtime',
      '',
      'The RAG runtime coordinates pre-retrieval, retrieval, post-retrieval, and answer generation.',
      '',
      'It can emit trace events for indexing, retrieval, and answer stages.'
    ].join('\n')
  );
  await writeFile(
    join(workspace, 'indexing.md'),
    [
      '# Indexing',
      '',
      'Indexing loads local documents, splits content into chunks, and stores a reusable snapshot.'
    ].join('\n')
  );
  return workspace;
}
