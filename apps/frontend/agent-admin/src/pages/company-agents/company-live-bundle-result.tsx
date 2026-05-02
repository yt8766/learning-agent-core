import { Badge } from '@/components/ui/badge';
import type { CompanyLiveGenerateResult } from '@agent/core';

interface CompanyLiveBundleResultProps {
  result: CompanyLiveGenerateResult;
}

export function CompanyLiveBundleResult({ result }: CompanyLiveBundleResultProps) {
  const { bundle } = result;
  return (
    <div className="rounded-xl border border-border/70 bg-card/90 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">生成结果</p>
        <Badge variant="outline">{bundle.requestId}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{bundle.createdAt}</p>
      <div className="mt-3 grid gap-2">
        {bundle.assets.map(asset => (
          <div
            key={asset.assetId}
            className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
          >
            <Badge variant="secondary">{asset.kind}</Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-mono text-foreground">{asset.uri}</p>
              <p className="text-[11px] text-muted-foreground">
                {asset.mimeType}
                {asset.provider ? ` · ${asset.provider}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
