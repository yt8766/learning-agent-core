import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { ApprovalCenterItem } from '../../types/admin';

interface ApprovalsPanelProps {
  approvals: ApprovalCenterItem[];
  loading: boolean;
  onDecision: (decision: 'approve' | 'reject', taskId: string, intent: string) => void;
}

export function ApprovalsPanel({ approvals, loading, onDecision }: ApprovalsPanelProps) {
  return (
    <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-stone-950">Approvals Center</CardTitle>
        <Badge variant="warning">{approvals.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {approvals.length === 0 ? (
          <p className="text-sm text-stone-500">当前没有待审批动作。</p>
        ) : (
          approvals.map(approval => (
            <article
              key={`${approval.taskId}-${approval.intent}`}
              className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{approval.intent}</p>
                  <p className="mt-1 text-xs text-stone-500">{approval.taskId}</p>
                </div>
                <Badge variant="warning">{approval.status}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-700">{approval.goal}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {approval.currentMinistry ? <Badge variant="secondary">{approval.currentMinistry}</Badge> : null}
                {approval.currentWorker ? <Badge variant="secondary">{approval.currentWorker}</Badge> : null}
                {approval.sessionId ? <Badge variant="secondary">{approval.sessionId}</Badge> : null}
              </div>
              <p className="mt-3 text-xs text-stone-500">{approval.reason ?? '等待管理员决策。'}</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => onDecision('approve', approval.taskId, approval.intent)} disabled={loading}>
                  批准
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => onDecision('reject', approval.taskId, approval.intent)}
                  disabled={loading}
                >
                  拒绝
                </Button>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
