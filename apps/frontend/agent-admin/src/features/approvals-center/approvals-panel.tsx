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
    <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-semibold text-stone-900">审批中心</CardTitle>
        <Badge variant="outline">{approvals.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {approvals.length === 0 ? (
          <p className="text-sm text-stone-500">当前没有待审批动作。</p>
        ) : (
          approvals.map(approval => (
            <article
              key={`${approval.taskId}-${approval.intent}`}
              className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold text-stone-900">{approval.intent}</strong>
                <Badge variant="warning">{approval.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-stone-500">{approval.taskId}</p>
              <p className="mt-3 text-sm leading-6 text-stone-700">{approval.goal}</p>
              <small className="mt-2 block text-xs text-stone-500">{approval.reason ?? approval.status}</small>
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
