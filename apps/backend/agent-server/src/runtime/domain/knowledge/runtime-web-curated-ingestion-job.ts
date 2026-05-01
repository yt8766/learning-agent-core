import type { KnowledgeTrustClass } from '@agent/knowledge';

import type { RuntimeWebCuratedKnowledgeIngestionInput } from './runtime-source-ingestion-adapters';

export interface RuntimeWebCuratedIngestionSource {
  sourceId: string;
  url: string;
  title?: string;
  version?: string;
  curatedBy?: string;
  trustClass?: Extract<KnowledgeTrustClass, 'curated' | 'official' | 'community' | 'unverified'>;
  metadata?: RuntimeWebCuratedKnowledgeIngestionInput['metadata'];
}

export interface RuntimeWebCuratedFetchedDocument {
  title?: string;
  content: string;
  finalUrl?: string;
  capturedAt?: string;
  version?: string;
}

export interface RuntimeWebCuratedIngestionJobInput {
  sources: readonly RuntimeWebCuratedIngestionSource[];
}

export interface RuntimeWebCuratedIngestionJobDeps<TResult> {
  fetchUrl: (url: URL) => Promise<RuntimeWebCuratedFetchedDocument>;
  ingestWebCuratedSources: (entries: readonly RuntimeWebCuratedKnowledgeIngestionInput[]) => Promise<TResult> | TResult;
  cleanContent?: (content: string) => string;
  trustPolicy?: (input: {
    url: URL;
    source: RuntimeWebCuratedIngestionSource;
    document: RuntimeWebCuratedFetchedDocument;
  }) => Extract<KnowledgeTrustClass, 'curated' | 'official' | 'community' | 'unverified'>;
}

export async function runRuntimeWebCuratedIngestionJob<TResult>(
  input: RuntimeWebCuratedIngestionJobInput,
  deps: RuntimeWebCuratedIngestionJobDeps<TResult>
): Promise<TResult> {
  const entries = await Promise.all(
    input.sources.map(async source => {
      const url = new URL(source.url);
      const document = await deps.fetchUrl(url);
      const content = (deps.cleanContent ?? cleanCuratedWebContent)(document.content);

      return {
        sourceId: source.sourceId,
        url: document.finalUrl ?? source.url,
        title: source.title ?? document.title ?? source.url,
        content,
        version: source.version ?? document.version,
        curatedBy: source.curatedBy,
        trustClass: source.trustClass ?? deps.trustPolicy?.({ url, source, document }) ?? 'curated',
        metadata: {
          ...source.metadata,
          capturedAt: document.capturedAt,
          sourceUrl: source.url
        }
      };
    })
  );

  return deps.ingestWebCuratedSources(entries);
}

function cleanCuratedWebContent(content: string) {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
