import { resolve } from 'node:path';

import * as KnowledgeSdkImport from '@agent/knowledge';
import type { KnowledgeChunk, KnowledgeSource, RetrievalHit } from '@agent/knowledge';

import { parseKnowledgeCliArgs, readBooleanOption, readIntegerOption, readStringOption } from './args';
import { LocalDirectoryLoader } from './local-doc-loader';
import { SnapshotSearchService } from './search';
import { readKnowledgeSnapshot, writeKnowledgeSnapshot } from './snapshot';
import { KnowledgeCliTraceWriter } from './trace';
import type { KnowledgeCliResult, KnowledgeCliSnapshot, KnowledgeCliSnapshotDocument } from './types';

const DEFAULT_INDEX_FILE = '.artifacts/knowledge-index-snapshot.json';
const KnowledgeSdk = resolveKnowledgeSdk(KnowledgeSdkImport);

export async function runKnowledgeCli(argv: string[]): Promise<KnowledgeCliResult> {
  try {
    const parsed = parseKnowledgeCliArgs(argv);
    if (parsed.command === 'help') {
      return ok(renderHelp());
    }
    if (parsed.command === 'index') {
      return ok(await runIndexCommand(parsed.options));
    }
    if (parsed.command === 'retrieval') {
      return ok(await runRetrievalCommand(parsed.options));
    }
    return ok(await runAskCommand(parsed.options));
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: getErrorMessage(error) };
  }
}

async function runIndexCommand(options: Record<string, string | boolean>): Promise<string> {
  const dir = requireOption(options, 'dir');
  const indexFile = resolve(readStringOption(options, 'indexFile') ?? DEFAULT_INDEX_FILE);
  const chunkSize = readIntegerOption(options, 'chunkSize', 800);
  const chunkOverlap = readIntegerOption(options, 'chunkOverlap', 120);
  const trace = new KnowledgeCliTraceWriter();
  const snapshot = await buildSnapshot({ dir, chunkSize, chunkOverlap });

  await writeKnowledgeSnapshot(indexFile, snapshot);
  trace.record({
    stage: 'index',
    message: 'Indexed local documents',
    data: { documentCount: snapshot.documents.length, chunkCount: snapshot.chunks.length, indexFile }
  });
  await trace.flush(readStringOption(options, 'traceFile'));

  return [
    `Indexed ${snapshot.documents.length} documents`,
    `Chunks: ${snapshot.chunks.length}`,
    `Snapshot: ${indexFile}`
  ].join('\n');
}

async function runRetrievalCommand(options: Record<string, string | boolean>): Promise<string> {
  const query = requireOption(options, 'query');
  const indexFile = resolve(requireOption(options, 'indexFile'));
  const topK = readIntegerOption(options, 'topK', 3);
  const trace = new KnowledgeCliTraceWriter();
  const snapshot = await readKnowledgeSnapshot(indexFile);
  const retrieval = await retrieveFromSnapshot(snapshot, query, topK);

  trace.record({
    stage: 'retrieval',
    message: 'Retrieved chunks from snapshot',
    data: { query, topK, hitCount: retrieval.hits.length, indexFile }
  });
  await trace.flush(readStringOption(options, 'traceFile'));

  return renderRetrieval(retrieval.hits, topK);
}

async function runAskCommand(options: Record<string, string | boolean>): Promise<string> {
  const query = requireOption(options, 'query');
  const topK = readIntegerOption(options, 'topK', 3);
  const trace = new KnowledgeCliTraceWriter();
  const snapshot = readStringOption(options, 'indexFile')
    ? await readKnowledgeSnapshot(resolve(requireOption(options, 'indexFile')))
    : await buildSnapshot({
        dir: requireOption(options, 'dir'),
        chunkSize: readIntegerOption(options, 'chunkSize', 800),
        chunkOverlap: readIntegerOption(options, 'chunkOverlap', 120)
      });
  const retrieval = await retrieveFromSnapshot(snapshot, query, topK);
  const answer = buildExtractiveAnswer(query, retrieval.hits);

  trace.record({
    stage: 'index',
    message: 'Prepared snapshot for ask command',
    data: { documentCount: snapshot.documents.length, chunkCount: snapshot.chunks.length }
  });
  trace.record({
    stage: 'retrieval',
    message: 'Retrieved chunks for answer',
    data: { query, topK, hitCount: retrieval.hits.length }
  });
  trace.record({
    stage: 'answer',
    message: 'Generated extractive answer',
    data: { citationCount: retrieval.hits.length }
  });
  await trace.flush(readStringOption(options, 'traceFile'));

  return renderAnswer(answer, retrieval.hits, readBooleanOption(options, 'debug'));
}

async function buildSnapshot(input: {
  dir: string;
  chunkSize: number;
  chunkOverlap: number;
}): Promise<KnowledgeCliSnapshot> {
  const loader = new LocalDirectoryLoader({ dir: input.dir });
  const loadedDocuments = await loader.load();
  const sources = new Map<string, KnowledgeSource>();
  const chunks: KnowledgeChunk[] = [];

  await KnowledgeSdk.runKnowledgeIndexing({
    loader: { load: async () => loadedDocuments },
    vectorIndex: { upsertKnowledge: async () => undefined },
    sourceIndex: { upsertKnowledgeSource: async source => void sources.set(source.id, source) },
    fulltextIndex: { upsertKnowledgeChunk: async chunk => void chunks.push(chunk) },
    sourceConfig: {
      sourceId: 'local-directory',
      sourceType: 'workspace-docs',
      trustClass: 'internal'
    },
    chunkSize: input.chunkSize,
    chunkOverlap: input.chunkOverlap
  });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    documents: loadedDocuments.map(toSnapshotDocument),
    sources: [...sources.values()],
    chunks
  };
}

async function retrieveFromSnapshot(snapshot: KnowledgeCliSnapshot, query: string, topK: number) {
  return KnowledgeSdk.runKnowledgeRetrieval({
    request: { query, limit: topK },
    searchService: new SnapshotSearchService(snapshot.chunks, snapshot.sources),
    assembleContext: true,
    includeDiagnostics: true
  });
}

function toSnapshotDocument(document: {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}): KnowledgeCliSnapshotDocument {
  return {
    id: document.id,
    title: typeof document.metadata.title === 'string' ? document.metadata.title : document.id,
    uri: typeof document.metadata.uri === 'string' ? document.metadata.uri : document.id,
    contentLength: document.content.length
  };
}

function renderRetrieval(hits: RetrievalHit[], topK: number): string {
  const lines = [`Top ${topK} retrieval hits`];
  if (hits.length === 0) {
    lines.push('No matching chunks found.');
    return lines.join('\n');
  }
  hits.forEach((hit, index) => {
    lines.push(`${index + 1}. ${hit.title} score=${hit.score.toFixed(3)}`);
    lines.push(`   ${compact(hit.content)}`);
  });
  return lines.join('\n');
}

function buildExtractiveAnswer(query: string, hits: RetrievalHit[]): string {
  if (hits.length === 0) {
    return `No answer found for "${query}" in the indexed documents.`;
  }
  return hits
    .slice(0, 3)
    .map(hit => compact(hit.content, 240))
    .join('\n');
}

function renderAnswer(answer: string, hits: RetrievalHit[], debug: boolean): string {
  const lines = ['Answer', answer, '', `Citations: ${hits.length}`];
  if (debug) {
    lines.push('', 'Debug hits', renderRetrieval(hits, hits.length || 0));
  }
  return lines.join('\n');
}

function compact(content: string, maxLength = 180): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function requireOption(options: Record<string, string | boolean>, key: string): string {
  const value = readStringOption(options, key);
  if (!value) {
    throw new Error(`Missing required option --${key}.`);
  }
  return value;
}

function renderHelp(): string {
  return [
    'Knowledge CLI',
    '',
    'Commands:',
    '  index --dir <path> [--indexFile <path>]',
    '  retrieval --indexFile <path> --query <text> [--topK 3]',
    '  ask --dir <path> --query <text> [--debug]',
    '  ask --indexFile <path> --query <text> [--debug]'
  ].join('\n');
}

function ok(stdout: string): KnowledgeCliResult {
  return { exitCode: 0, stdout, stderr: '' };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveKnowledgeSdk(module: unknown): typeof import('@agent/knowledge') {
  if (isKnowledgeSdkModule(module)) {
    return module;
  }

  if (module && typeof module === 'object' && 'default' in module) {
    const defaultExport = (module as { default?: unknown }).default;
    if (isKnowledgeSdkModule(defaultExport)) {
      return defaultExport;
    }
  }

  throw new Error('Unable to load @agent/knowledge runtime exports.');
}

function isKnowledgeSdkModule(module: unknown): module is typeof import('@agent/knowledge') {
  return (
    module !== null &&
    typeof module === 'object' &&
    'runKnowledgeIndexing' in module &&
    'runKnowledgeRetrieval' in module
  );
}
