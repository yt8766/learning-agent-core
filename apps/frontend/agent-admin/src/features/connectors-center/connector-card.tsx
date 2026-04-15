import { Badge } from '@/components/ui/badge';
import type { ConnectorRecord } from '@/types/admin';
import { ConnectorFeed } from './connector-card-primitives';
import { ConnectorActions, ConnectorBadges, ConnectorCapabilities, ConnectorMetadata } from './connector-card-sections';

export type ConnectorCardProps = {
  connector: ConnectorRecord;
  onSelectTask: (taskId: string) => void;
  onCloseSession: (connectorId: string) => void;
  onRefreshConnectorDiscovery: (connectorId: string) => void;
  onEnableConnector: (connectorId: string) => void;
  onDisableConnector: (connectorId: string) => void;
  onSetConnectorPolicy: (connectorId: string, effect: 'allow' | 'deny' | 'require-approval' | 'observe') => void;
  onClearConnectorPolicy: (connectorId: string) => void;
  onSetCapabilityPolicy: (
    connectorId: string,
    capabilityId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) => void;
  onClearCapabilityPolicy: (connectorId: string, capabilityId: string) => void;
  onOpenTemplateForm: (
    templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template',
    connector?: ConnectorRecord
  ) => void;
};

export function ConnectorCard(props: ConnectorCardProps) {
  const { connector } = props;
  return (
    <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{connector.displayName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{connector.id}</p>
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
      <ConnectorBadges connector={connector} />
      <ConnectorMetadata connector={connector} />
      <ConnectorActions {...props} />
      <ConnectorCapabilities {...props} />
      <ConnectorFeed
        title="Approval Policies"
        items={connector.approvalPolicies?.slice(0, 4).map(policy => (
          <div key={policy.id} className="rounded-lg border border-amber-200/70 bg-background px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{policy.targetId}</span>
              <Badge variant="outline">{policy.mode}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{policy.reason}</p>
          </div>
        ))}
        tone="amber"
      />
      <ConnectorFeed
        title="Health Checks"
        items={connector.healthChecks?.slice(0, 2).map(check => (
          <div
            key={`${connector.id}-${check.checkedAt}`}
            className="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{check.healthState}</span>
              <span className="text-muted-foreground">{check.checkedAt}</span>
            </div>
            {check.reason ? <p className="mt-1 text-muted-foreground">{check.reason}</p> : null}
          </div>
        ))}
      />
      <ConnectorFeed
        title="Discovery History"
        items={connector.discoveryHistory?.slice(0, 3).map(entry => (
          <div
            key={`${connector.id}-${entry.discoveredAt}-${entry.discoveryMode}`}
            className="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{entry.discoveryMode}</span>
              <span className="text-muted-foreground">{entry.discoveredAt}</span>
            </div>
            <p className="mt-1 text-muted-foreground">session: {entry.sessionState}</p>
            <p className="mt-1 text-muted-foreground">
              capabilities: {entry.discoveredCapabilities.slice(0, 5).join(', ') || 'none'}
            </p>
            {entry.error ? <p className="mt-1 text-amber-700">error: {entry.error}</p> : null}
          </div>
        ))}
      />
      <ConnectorFeed
        title="Governance Timeline"
        items={connector.recentGovernanceAudits?.slice(0, 4).map(entry => (
          <div key={entry.id} className="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{entry.action}</span>
              <Badge
                variant={
                  entry.outcome === 'success' ? 'success' : entry.outcome === 'pending' ? 'warning' : 'destructive'
                }
              >
                {entry.outcome}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{entry.at}</p>
            <p className="mt-1 text-muted-foreground">actor: {entry.actor}</p>
            {entry.reason ? <p className="mt-1 text-muted-foreground">{entry.reason}</p> : null}
          </div>
        ))}
      />
    </article>
  );
}
