import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { ConnectorRecord } from '../../types/admin';

interface ConnectorsCenterPanelProps {
  connectors: ConnectorRecord[];
  onCloseSession: (connectorId: string) => void;
}

export function ConnectorsCenterPanel({ connectors, onCloseSession }: ConnectorsCenterPanelProps) {
  return (
    <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-stone-950">Connector &amp; Policy Center</CardTitle>
        <Badge variant="outline">{connectors.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {connectors.length === 0 ? (
          <p className="text-sm text-stone-500">当前没有已注册的 MCP connectors。</p>
        ) : (
          connectors.map(connector => (
            <article key={connector.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{connector.displayName}</p>
                  <p className="mt-1 text-xs text-stone-500">{connector.id}</p>
                </div>
                <Badge
                  variant={
                    connector.healthState === 'healthy'
                      ? 'success'
                      : connector.healthState === 'disabled'
                        ? 'destructive'
                        : 'warning'
                  }
                >
                  {connector.healthState}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{connector.transport}</Badge>
                {connector.sessionState ? <Badge variant="secondary">session {connector.sessionState}</Badge> : null}
                {connector.discoveryMode ? (
                  <Badge variant="secondary">discovery {connector.discoveryMode}</Badge>
                ) : null}
                <Badge variant="secondary">capabilities {connector.capabilityCount}</Badge>
                {typeof connector.implementedCapabilityCount === 'number' ? (
                  <Badge variant="secondary">implemented {connector.implementedCapabilityCount}</Badge>
                ) : null}
                {typeof connector.discoveredCapabilityCount === 'number' ? (
                  <Badge variant="secondary">discovered {connector.discoveredCapabilityCount}</Badge>
                ) : null}
                <Badge variant="secondary">审批 {connector.approvalRequiredCount}</Badge>
                <Badge variant="secondary">高风险 {connector.highRiskCount}</Badge>
              </div>
              {connector.healthReason ? <p className="mt-3 text-xs text-stone-500">{connector.healthReason}</p> : null}
              {connector.lastDiscoveredAt ? (
                <p className="mt-1 text-xs text-stone-500">last discovered {connector.lastDiscoveredAt}</p>
              ) : null}
              {connector.sessionCreatedAt ? (
                <p className="mt-1 text-xs text-stone-500">session created {connector.sessionCreatedAt}</p>
              ) : null}
              {connector.sessionLastActivityAt ? (
                <p className="mt-1 text-xs text-stone-500">last activity {connector.sessionLastActivityAt}</p>
              ) : null}
              {typeof connector.sessionRequestCount === 'number' ? (
                <p className="mt-1 text-xs text-stone-500">session requests {connector.sessionRequestCount}</p>
              ) : null}
              {typeof connector.sessionIdleMs === 'number' ? (
                <p className="mt-1 text-xs text-stone-500">idle {Math.round(connector.sessionIdleMs / 1000)}s</p>
              ) : null}
              {connector.lastDiscoveryError ? (
                <p className="mt-1 text-xs text-amber-700">{connector.lastDiscoveryError}</p>
              ) : null}
              {connector.transport === 'stdio' && connector.sessionState === 'connected' ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onCloseSession(connector.id)}
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                  >
                    关闭 session
                  </button>
                </div>
              ) : null}
              {connector.discoveredCapabilities?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    Discovered Capabilities
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {connector.discoveredCapabilities.slice(0, 8).map(capability => (
                      <div key={`${connector.id}-${capability}`}>
                        <Badge variant="outline">{capability}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 grid gap-2">
                {connector.capabilities.slice(0, 4).map(capability => (
                  <div
                    key={`${connector.id}-${capability.id}`}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-stone-900">{capability.toolName}</span>
                      <span>{capability.riskLevel}</span>
                    </div>
                    <p className="mt-1">{capability.displayName}</p>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
