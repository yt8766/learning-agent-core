import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { KnowledgeGovernanceProjection } from './knowledge-governance-types';

function providerStatusVariant(status: string) {
  if (status === 'ok') {
    return 'success';
  }
  if (status === 'degraded') {
    return 'warning';
  }
  return 'destructive';
}

function ingestionStatusVariant(status: string) {
  if (status === 'active') {
    return 'success';
  }
  if (status === 'paused' || status === 'unknown') {
    return 'warning';
  }
  return 'destructive';
}

export function KnowledgeGovernanceDiagnostics({ projection }: { projection: KnowledgeGovernanceProjection }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Provider Health</CardTitle>
          <Badge variant="outline">{projection.providerHealth.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {projection.providerHealth.map(provider => (
            <div key={provider.provider} className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{provider.provider}</p>
                <Badge variant={providerStatusVariant(provider.status)}>{provider.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {provider.warningCount} warnings{provider.reason ? ` · ${provider.reason}` : ''}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Ingestion Sources</CardTitle>
          <Badge variant="outline">{projection.ingestionSources.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {projection.ingestionSources.map(source => (
            <div key={source.id} className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{source.label}</p>
                <Badge variant={ingestionStatusVariant(source.status)}>{source.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {source.sourceType} · {source.indexedDocumentCount} indexed · {source.failedDocumentCount} failed
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Agent Usage</CardTitle>
          <Badge variant="outline">{projection.agentUsage.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {projection.agentUsage.map(agent => (
            <div key={agent.agentId} className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{agent.agentLabel}</p>
                <Badge variant="outline">{agent.knowledgeBaseIds.length} KB</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {agent.recentRunCount} recent runs · {agent.evidenceCount} evidence refs
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
