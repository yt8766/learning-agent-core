import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { PlatformConsoleRecord } from '@/types/admin';

export function SkillSourcesManifestCard(props: {
  manifest: PlatformConsoleRecord['skillSources']['manifests'][number];
  onInstallSkill: (manifestId: string, sourceId?: string) => void;
}) {
  const { manifest } = props;
  return (
    <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {manifest.name} <span className="text-muted-foreground">v{manifest.version}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{manifest.description}</p>
        </div>
        <Badge variant="secondary">{manifest.riskLevel}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary">{manifest.publisher}</Badge>
        <Badge variant="secondary">{manifest.approvalPolicy}</Badge>
        {manifest.license ? <Badge variant="secondary">{manifest.license}</Badge> : null}
        {manifest.publishedAt ? <Badge variant="outline">{manifest.publishedAt}</Badge> : null}
        {manifest.safety ? <Badge variant="outline">{manifest.safety.verdict}</Badge> : null}
        {manifest.safety ? <Badge variant="outline">trust {manifest.safety.trustScore}</Badge> : null}
        {manifest.requiredConnectors?.map(item => (
          <span key={`${manifest.id}-${item}`}>
            <Badge variant="outline">{item}</Badge>
          </span>
        ))}
        {manifest.allowedTools?.map(item => (
          <span key={`${manifest.id}-tool-${item}`}>
            <Badge variant="outline">{item}</Badge>
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{manifest.summary ?? manifest.entry}</p>
      {manifest.artifactUrl ? (
        <p className="mt-1 text-xs text-muted-foreground">artifact: {manifest.artifactUrl}</p>
      ) : null}
      {manifest.homepageUrl ? (
        <p className="mt-1 text-xs text-muted-foreground">homepage: {manifest.homepageUrl}</p>
      ) : null}
      {manifest.compatibility ? <p className="mt-1 text-xs text-muted-foreground">{manifest.compatibility}</p> : null}
      {typeof manifest.sizeBytes === 'number' ? (
        <p className="mt-1 text-xs text-muted-foreground">size {manifest.sizeBytes} bytes</p>
      ) : null}
      {manifest.safety?.reasons.length ? (
        <p className="mt-1 text-xs text-muted-foreground">{manifest.safety.reasons.join('；')}</p>
      ) : null}
      <div className="mt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => props.onInstallSkill(manifest.id, manifest.sourceId)}
        >
          安装到技能工坊
        </Button>
      </div>
    </article>
  );
}
