import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { EvidenceRecord } from '../../types/admin';

interface EvidenceCenterPanelProps {
  evidence: EvidenceRecord[];
}

export function EvidenceCenterPanel({ evidence }: EvidenceCenterPanelProps) {
  return (
    <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-stone-950">Evidence Center</CardTitle>
        <Badge variant="outline">{evidence.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {evidence.length === 0 ? (
          <p className="text-sm text-stone-500">当前没有可展示的证据记录。</p>
        ) : (
          evidence.slice(0, 20).map(item => (
            <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{item.summary}</p>
                  <p className="mt-1 text-xs text-stone-500">{item.taskGoal}</p>
                </div>
                <Badge variant="outline">{item.trustClass}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{item.sourceType}</Badge>
                {item.linkedRunId ? <Badge variant="secondary">{item.linkedRunId}</Badge> : null}
              </div>
              <p className="mt-3 text-xs text-stone-500">{item.createdAt}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
