import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type {
  RuntimeCenterKnowledgeHybridDiagnosticsRecord,
  RuntimeCenterKnowledgeSearchDiagnosticsPayloadRecord
} from '@/types/admin/runtime';
import type { RuntimeSummarySectionProps } from './runtime-summary-types';

interface PostRetrievalDiagnosticsSummary {
  rows: string[];
}

interface HybridDiagnosticsSummary {
  rows: string[];
}

type RuntimeRecord = RuntimeSummarySectionProps['runtime'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getHybridDiagnosticsRecord(
  diagnostics: RuntimeCenterKnowledgeSearchDiagnosticsPayloadRecord | undefined
): RuntimeCenterKnowledgeHybridDiagnosticsRecord | undefined {
  if (!diagnostics) return undefined;
  return isRecord(diagnostics.hybrid) ? diagnostics.hybrid : diagnostics;
}

function getHybridDiagnosticsSummary(
  diagnostics: RuntimeCenterKnowledgeSearchDiagnosticsPayloadRecord | undefined
): HybridDiagnosticsSummary | undefined {
  const hybridDiagnostics = getHybridDiagnosticsRecord(diagnostics);
  if (!hybridDiagnostics || !isRecord(hybridDiagnostics)) return undefined;

  const rows: string[] = [];
  const retrievalMode = getString(hybridDiagnostics, 'retrievalMode');
  const enabledRetrievers = getStringList(hybridDiagnostics, 'enabledRetrievers');
  const failedRetrievers = getStringList(hybridDiagnostics, 'failedRetrievers');
  const candidateCount = getNumber(hybridDiagnostics, 'candidateCount');
  const fusionStrategy = getString(hybridDiagnostics, 'fusionStrategy');
  const prefilterApplied = getBoolean(hybridDiagnostics, 'prefilterApplied');

  if (retrievalMode) rows.push(`mode ${retrievalMode}`);
  if (enabledRetrievers.length || failedRetrievers.length) {
    rows.push(
      `retrievers ${enabledRetrievers.length ? enabledRetrievers.join(', ') : 'none'} / failed ${
        failedRetrievers.length ? failedRetrievers.join(', ') : 'none'
      }`
    );
  }
  if (candidateCount !== undefined) rows.push(`candidates ${candidateCount}`);
  if (fusionStrategy) rows.push(`fusion ${fusionStrategy}`);
  if (prefilterApplied !== undefined) rows.push(`prefilter ${prefilterApplied ? 'applied' : 'skipped'}`);

  return rows.length ? { rows } : undefined;
}

function getPostRetrievalDiagnosticsSummary(
  diagnostics: RuntimeCenterKnowledgeSearchDiagnosticsPayloadRecord | undefined
): PostRetrievalDiagnosticsSummary | undefined {
  if (!diagnostics || !isRecord(diagnostics.postRetrieval)) return undefined;
  const { postRetrieval } = diagnostics;
  const rows: string[] = [];

  if (isRecord(postRetrieval.filtering)) {
    const beforeCount = getNumber(postRetrieval.filtering, 'beforeCount');
    const afterCount = getNumber(postRetrieval.filtering, 'afterCount');
    const droppedCount = getNumber(postRetrieval.filtering, 'droppedCount');
    const maskedCount = getNumber(postRetrieval.filtering, 'maskedCount');
    if (beforeCount !== undefined && afterCount !== undefined && droppedCount !== undefined) {
      rows.push(
        `filter ${beforeCount}->${afterCount} / dropped ${droppedCount}${
          maskedCount !== undefined ? ` / masked ${maskedCount}` : ''
        }`
      );
    }
  }

  if (isRecord(postRetrieval.ranking)) {
    const strategy = getString(postRetrieval.ranking, 'strategy');
    const signals = getStringList(postRetrieval.ranking, 'signals');
    if (strategy && signals.length) rows.push(`rank ${strategy} / ${signals.join(', ')}`);
  }

  if (isRecord(postRetrieval.diversification)) {
    const beforeCount = getNumber(postRetrieval.diversification, 'beforeCount');
    const afterCount = getNumber(postRetrieval.diversification, 'afterCount');
    const maxPerSource = getNumber(postRetrieval.diversification, 'maxPerSource');
    if (beforeCount !== undefined && afterCount !== undefined && maxPerSource !== undefined) {
      rows.push(`diversify ${beforeCount}->${afterCount} / maxPerSource ${maxPerSource}`);
    }
  }

  return rows.length ? { rows } : undefined;
}

export function RuntimeKnowledgeSummaryCard({ runtime }: { runtime: RuntimeRecord }) {
  const knowledgeSearchStatus = runtime.knowledgeSearchStatus;
  const knowledgeSearchLastDiagnostics = runtime.knowledgeSearchLastDiagnostics;
  const knowledgeSearchDiagnostics = Array.isArray(knowledgeSearchStatus?.diagnostics)
    ? knowledgeSearchStatus.diagnostics
    : [];
  const knowledgeSearchWarnings = knowledgeSearchDiagnostics.filter(diagnostic => diagnostic.severity === 'warning');
  const postRetrievalDiagnosticsSummary = getPostRetrievalDiagnosticsSummary(
    knowledgeSearchLastDiagnostics?.diagnostics
  );
  const hybridDiagnosticsSummary = getHybridDiagnosticsSummary(knowledgeSearchLastDiagnostics?.diagnostics);

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Wenyuan & Cangjing</CardTitle>
        <Badge variant="outline">{runtime.knowledgeOverview?.stores.length ?? 0}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!runtime.knowledgeOverview ? (
          <DashboardEmptyState message="当前还没有知识库总览。" />
        ) : (
          <>
            <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 text-xs text-muted-foreground">
              <p>sources {runtime.knowledgeOverview.sourceCount}</p>
              <p>chunks {runtime.knowledgeOverview.chunkCount}</p>
              <p>embeddings {runtime.knowledgeOverview.embeddingCount}</p>
              <p>
                searchable {runtime.knowledgeOverview.searchableDocumentCount} / blocked{' '}
                {runtime.knowledgeOverview.blockedDocumentCount}
              </p>
              {knowledgeSearchStatus ? (
                <>
                  <p>
                    retrieval {knowledgeSearchStatus.configuredMode} -&gt; {knowledgeSearchStatus.effectiveMode}
                  </p>
                  <p>
                    vector {knowledgeSearchStatus.vectorConfigured ? 'configured' : 'off'} / hybrid{' '}
                    {knowledgeSearchStatus.hybridEnabled ? 'enabled' : 'disabled'}
                  </p>
                  <p>provider {knowledgeSearchStatus.vectorProviderId ?? 'none'}</p>
                  {knowledgeSearchStatus.vectorProviderHealth ? (
                    <p>health {knowledgeSearchStatus.vectorProviderHealth.status}</p>
                  ) : null}
                  {knowledgeSearchWarnings.length ? <p>warnings {knowledgeSearchWarnings.length}</p> : null}
                </>
              ) : null}
              {knowledgeSearchLastDiagnostics ? (
                <p>
                  latest query hits {knowledgeSearchLastDiagnostics.hitCount}/{knowledgeSearchLastDiagnostics.total}
                </p>
              ) : null}
              {hybridDiagnosticsSummary?.rows.map(row => (
                <p key={row}>{row}</p>
              ))}
              {postRetrievalDiagnosticsSummary?.rows.map(row => (
                <p key={row}>{row}</p>
              ))}
            </article>
            {runtime.knowledgeOverview.stores.map(store => (
              <article key={store.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">{store.displayName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{store.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {store.store} / {store.status}
                </p>
              </article>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
