import type { ChatCheckpointRecord, ChatSessionRecord } from '../../types/chat';
import { formatSessionTime, getSessionStatusLabel } from '../../hooks/use-chat-session';

interface AgentStatusPanelProps {
  activeSession?: ChatSessionRecord;
  checkpoint?: ChatCheckpointRecord;
  loading: boolean;
  activeSessionId: string;
  onRecover: () => void;
  onRefresh: () => void;
}

export function AgentStatusPanel(props: AgentStatusPanelProps) {
  const { activeSession, checkpoint, loading, activeSessionId, onRecover, onRefresh } = props;

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>当前会话</h3>
        <span>{activeSession ? getSessionStatusLabel(activeSession.status) : '未开始'}</span>
      </div>
      <div className="panel-section">
        <strong>执行节点</strong>
        <p>{checkpoint?.graphState?.currentStep ?? '尚未开始'}</p>
      </div>
      <div className="panel-section two-column">
        <div>
          <strong>重试次数</strong>
          <p>{`${checkpoint?.graphState?.retryCount ?? 0}/${checkpoint?.graphState?.maxRetries ?? 0}`}</p>
        </div>
        <div>
          <strong>更新时间</strong>
          <p>{formatSessionTime(activeSession?.updatedAt)}</p>
        </div>
      </div>
      <div className="panel-actions">
        <button className="panel-button" disabled={!activeSessionId || loading} onClick={onRecover}>
          恢复会话
        </button>
        <button className="panel-button subtle" disabled={!activeSessionId || loading} onClick={onRefresh}>
          刷新
        </button>
      </div>
    </div>
  );
}

interface AgentStateListProps {
  checkpoint?: ChatCheckpointRecord;
}

export function AgentStateList({ checkpoint }: AgentStateListProps) {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>Agent 状态</h3>
        <span>{checkpoint?.agentStates.length ?? 0}</span>
      </div>
      {(checkpoint?.agentStates ?? []).length === 0 ? <p className="panel-empty">暂无 Agent 状态</p> : null}
      {(checkpoint?.agentStates ?? []).map(state => (
        <div key={state.role} className="agent-state-row">
          <span>{state.role}</span>
          <span>{state.status}</span>
        </div>
      ))}
    </div>
  );
}
