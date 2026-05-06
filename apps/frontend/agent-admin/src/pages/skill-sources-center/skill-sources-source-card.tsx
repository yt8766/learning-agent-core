import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { PlatformConsoleRecord } from '@/types/admin';

export function SkillSourcesSourceCard(props: {
  source: PlatformConsoleRecord['skillSources']['sources'][number];
  onEnableSource: (sourceId: string) => void;
  onDisableSource: (sourceId: string) => void;
  onSyncSource: (sourceId: string) => void;
}) {
  const { source } = props;
  return (
    <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{source.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{source.baseUrl}</p>
        </div>
        <Badge variant={source.enabled ? 'success' : 'secondary'}>{source.healthState ?? 'unknown'}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary">{source.kind}</Badge>
        {source.discoveryMode ? <Badge variant="secondary">{source.discoveryMode}</Badge> : null}
        <Badge variant="secondary">{source.priority}</Badge>
        <Badge variant="secondary">{source.trustClass}</Badge>
        {source.syncStrategy ? <Badge variant="secondary">sync {source.syncStrategy}</Badge> : null}
        {source.profilePolicy ? (
          <Badge variant={source.profilePolicy.enabledByProfile ? 'success' : 'warning'}>
            profile {source.profilePolicy.enabledByProfile ? 'allowed' : 'restricted'}
          </Badge>
        ) : null}
        {source.authMode ? <Badge variant="secondary">auth {source.authMode}</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton
          onClick={() => (source.enabled ? props.onDisableSource(source.id) : props.onEnableSource(source.id))}
        >
          {source.enabled ? '停用来源' : '启用来源'}
        </ActionButton>
        {(source.discoveryMode ?? 'local-dir') !== 'local-dir' ? (
          <ActionButton onClick={() => props.onSyncSource(source.id)}>Sync Now</ActionButton>
        ) : null}
      </div>
      {source.healthReason ? <p className="mt-3 text-xs text-muted-foreground">{source.healthReason}</p> : null}
      {source.indexUrl ? <p className="mt-1 text-xs text-muted-foreground">index: {source.indexUrl}</p> : null}
      {source.packageBaseUrl ? (
        <p className="mt-1 text-xs text-muted-foreground">package: {source.packageBaseUrl}</p>
      ) : null}
      {source.lastSyncedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">last synced {source.lastSyncedAt}</p>
      ) : null}
      {source.profilePolicy ? (
        <p className="mt-1 text-xs text-muted-foreground">profile policy: {source.profilePolicy.reason}</p>
      ) : null}
    </article>
  );
}

function ActionButton(props: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={props.onClick}>
      {props.children}
    </Button>
  );
}
