import { LocalKnowledgeFacade, runKnowledgeRetrieval } from '../src';
import { HybridKnowledgeSearchService } from '../src/retrieval/hybrid-knowledge-search-service';
import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import type { KnowledgeSourceType, RetrievalHit, RetrievalRequest, RetrievalResult } from '../src';

interface SourceAuditItem {
  source: string;
  sourceType: KnowledgeSourceType;
  docType: string;
  emitsUnifiedRetrieval: boolean;
  firstClassSourceType: boolean;
}

interface ProductionIngestionRuntimeCenterDemo {
  path: string[];
  retrievalRequest: RetrievalRequest;
  sourceAudit: SourceAuditItem[];
  retrievalHits: RetrievalHit[];
  agentAdminPayload: {
    runtime: {
      knowledgeOverview: {
        sourceCount: number;
        chunkCount: number;
        searchableDocumentCount: number;
        blockedDocumentCount: number;
      };
      knowledgeSearchStatus: {
        configuredMode: 'hybrid';
        effectiveMode: 'hybrid';
        vectorProviderId: string;
        vectorConfigured: boolean;
        hybridEnabled: boolean;
      };
      knowledgeSearchLastDiagnostics: {
        query: string;
        limit: number;
        hitCount: number;
        total: number;
        diagnostics: {
          retrievalMode: 'hybrid';
          enabledRetrievers: ['keyword', 'vector'];
          failedRetrievers: [];
          fusionStrategy: 'rrf';
        };
      };
    };
  };
}

const SOURCE_AUDIT: SourceAuditItem[] = [
  {
    source: 'user upload',
    sourceType: 'user-upload',
    docType: 'uploaded-policy',
    emitsUnifiedRetrieval: true,
    firstClassSourceType: true
  },
  {
    source: 'connector sync',
    sourceType: 'connector-manifest',
    docType: 'connector-sync',
    emitsUnifiedRetrieval: true,
    firstClassSourceType: true
  },
  {
    source: 'catalog sync',
    sourceType: 'catalog-sync',
    docType: 'catalog-entry',
    emitsUnifiedRetrieval: true,
    firstClassSourceType: true
  },
  {
    source: 'web curated',
    sourceType: 'web-curated',
    docType: 'curated-reference',
    emitsUnifiedRetrieval: true,
    firstClassSourceType: true
  },
  {
    source: 'agent skills',
    sourceType: 'workspace-docs',
    docType: 'agent-skill',
    emitsUnifiedRetrieval: true,
    firstClassSourceType: false
  }
];

export async function runProductionIngestionRuntimeCenterDemo(): Promise<ProductionIngestionRuntimeCenterDemo> {
  const facade = new LocalKnowledgeFacade();
  const updatedAt = '2026-05-01T00:00:00.000Z';

  for (const [index, source] of SOURCE_AUDIT.entries()) {
    const sourceId = `source-${index + 1}`;
    await facade.sourceRepository.upsert({
      id: sourceId,
      sourceType: source.sourceType,
      uri: `/knowledge/${sourceId}.md`,
      title: source.source,
      trustClass: 'internal',
      updatedAt
    });
    await facade.chunkRepository.upsert({
      id: `chunk-${index + 1}`,
      sourceId,
      documentId: `doc-${index + 1}`,
      chunkIndex: 0,
      content: `production ingestion ${source.source} connector catalog upload curated skill policy`,
      searchable: true,
      metadata: { docType: source.docType, status: 'active' },
      updatedAt
    });
  }

  const retrievalRequest: RetrievalRequest = {
    query: 'production ingestion policy connector catalog upload curated skill',
    limit: 8,
    allowedSourceTypes: ['user-upload', 'connector-manifest', 'catalog-sync', 'web-curated', 'workspace-docs']
  };
  const searchService = new HybridKnowledgeSearchService(
    new FakeOpenSearchKnowledgeSearchService(facade.searchService),
    new FakeChromaKnowledgeSearchService(facade.searchService)
  );
  const retrievalResult = await runKnowledgeRetrieval({
    request: retrievalRequest,
    searchService,
    includeDiagnostics: true
  });

  const retrievalHits = [...retrievalResult.hits].sort(
    (left, right) =>
      SOURCE_AUDIT.findIndex(item => item.sourceType === left.sourceType) -
      SOURCE_AUDIT.findIndex(item => item.sourceType === right.sourceType)
  );

  return {
    path: ['RuntimeHost', 'AgentRuntime', 'RuntimeCenter', 'agent-admin'],
    retrievalRequest,
    sourceAudit: SOURCE_AUDIT,
    retrievalHits,
    agentAdminPayload: {
      runtime: {
        knowledgeOverview: {
          sourceCount: SOURCE_AUDIT.length,
          chunkCount: SOURCE_AUDIT.length,
          searchableDocumentCount: SOURCE_AUDIT.length,
          blockedDocumentCount: 0
        },
        knowledgeSearchStatus: {
          configuredMode: 'hybrid',
          effectiveMode: 'hybrid',
          vectorProviderId: 'fake-chroma',
          vectorConfigured: true,
          hybridEnabled: true
        },
        knowledgeSearchLastDiagnostics: {
          query: retrievalRequest.query,
          limit: retrievalRequest.limit ?? 8,
          hitCount: retrievalHits.length,
          total: retrievalHits.length,
          diagnostics: {
            retrievalMode: 'hybrid',
            enabledRetrievers: ['keyword', 'vector'],
            failedRetrievers: [],
            fusionStrategy: 'rrf'
          }
        }
      }
    }
  };
}

class FakeOpenSearchKnowledgeSearchService implements KnowledgeSearchService {
  constructor(private readonly delegate: KnowledgeSearchService) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    return this.delegate.search(request);
  }
}

class FakeChromaKnowledgeSearchService implements KnowledgeSearchService {
  constructor(private readonly delegate: KnowledgeSearchService) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const result = await this.delegate.search(request);
    return {
      ...result,
      hits: result.hits.map((hit, index) => ({
        ...hit,
        score: Math.max(hit.score, 0.98 - index * 0.04)
      }))
    };
  }
}

if (process.argv[1]?.endsWith('production-ingestion-runtime-center.ts')) {
  runProductionIngestionRuntimeCenterDemo()
    .then(result => {
      console.log(
        JSON.stringify(
          {
            path: result.path,
            sourceAudit: result.sourceAudit,
            hitCount: result.retrievalHits.length,
            knowledgeSearchLastDiagnostics: result.agentAdminPayload.runtime.knowledgeSearchLastDiagnostics
          },
          null,
          2
        )
      );
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
