import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/utils/utils';

import type { KnowledgeGovernanceFlowNodeData, KnowledgeGovernanceNodeTone } from './knowledge-governance-types';

const toneClassNames: Record<KnowledgeGovernanceNodeTone, string> = {
  neutral: 'border-border/70 bg-background',
  success: 'border-emerald-200 bg-emerald-50/80',
  warning: 'border-amber-200 bg-amber-50/80',
  danger: 'border-destructive/30 bg-destructive/5'
};

const toneLabels: Record<KnowledgeGovernanceNodeTone, string> = {
  neutral: '治理',
  success: '健康',
  warning: '关注',
  danger: '阻塞'
};

function getToneVariant(tone: KnowledgeGovernanceNodeTone) {
  if (tone === 'success') {
    return 'success';
  }
  if (tone === 'warning') {
    return 'warning';
  }
  if (tone === 'danger') {
    return 'destructive';
  }
  return 'outline';
}

export function KnowledgeGovernanceNode({ data }: { data: KnowledgeGovernanceFlowNodeData }) {
  return (
    <Card className={cn('w-56 shadow-sm', toneClassNames[data.tone])}>
      <CardContent className="grid gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{data.label}</p>
          <Badge variant={getToneVariant(data.tone)}>{toneLabels[data.tone]}</Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{data.detail}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{data.meta}</p>
      </CardContent>
    </Card>
  );
}
