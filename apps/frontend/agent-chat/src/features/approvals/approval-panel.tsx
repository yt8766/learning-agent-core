import type { ApprovalRecord } from '@/types/chat';

interface ApprovalPanelProps {
  approvals: ApprovalRecord[];
  onDecision: (intent: string, approved: boolean) => void;
}

export function ApprovalPanel({ approvals, onDecision }: ApprovalPanelProps) {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>审批</h3>
        <span>{approvals.length}</span>
      </div>
      {approvals.length === 0 ? <p className="panel-empty">当前没有待审批动作</p> : null}
      {approvals.map(approval => (
        <div key={`${approval.intent}-${approval.decision}`} className="approval-item">
          <div>
            <strong>{approval.intent}</strong>
            <p>{approval.reason ?? '高风险动作需要人工确认'}</p>
          </div>
          <div className="approval-buttons">
            <button className="panel-button" onClick={() => onDecision(approval.intent, true)}>
              批准
            </button>
            <button className="panel-button subtle" onClick={() => onDecision(approval.intent, false)}>
              拒绝
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
