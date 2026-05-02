import type { ChatCheckpointRecord, ChatSessionRecord } from '@/types/chat';
import { formatSessionTime, getSessionStatusLabel } from '@/hooks/use-chat-session';

function getCheckpointStageLabel(checkpoint?: ChatCheckpointRecord) {
  if (checkpoint?.activeInterrupt?.status === 'pending') {
    return 'interrupt';
  }

  switch (checkpoint?.currentExecutionStep?.stage) {
    case 'task-planning':
      return 'plan';
    case 'route-selection':
      return 'route';
    case 'research':
      return 'research';
    case 'execution':
      return 'execution';
    case 'review':
      return 'review';
    case 'delivery':
      return 'delivery';
    case 'approval-interrupt':
      return 'interrupt';
    case 'recovery':
      return 'recover';
    default:
      return checkpoint?.executionMode === 'plan' ? 'plan' : 'execution';
  }
}

function getFallbackSummary(checkpoint?: ChatCheckpointRecord) {
  const specialistFallback = checkpoint?.dispatches?.some(item => item.kind === 'fallback');
  if (specialistFallback) {
    return '当前调度链已启用 fallback dispatch。';
  }

  if (checkpoint?.chatRoute?.adapter === 'fallback' || checkpoint?.chatRoute?.adapter === 'readiness-fallback') {
    return checkpoint.chatRoute.reason || '当前路由已进入 fallback 分支。';
  }

  return '当前未观察到 fallback。';
}

function getRecoverabilitySummary(checkpoint?: ChatCheckpointRecord) {
  if (!checkpoint?.activeInterrupt && !checkpoint?.interruptHistory?.length) {
    return '当前没有可恢复中断。';
  }

  if (checkpoint.activeInterrupt?.status === 'pending') {
    return '存在待恢复中断，可在确认后继续。';
  }

  return '当前中断已处理，可继续检查历史恢复链路。';
}

function getAgentStateLabel(status?: string) {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'running':
      return '处理中';
    case 'failed':
      return '异常';
    case 'queued':
      return '排队中';
    case 'waiting_interrupt':
      return '待澄清方案';
    case 'waiting_approval':
      return '待确认';
    case 'cancelled':
      return '已取消';
    case 'blocked':
      return '已阻塞';
    default:
      return '待处理';
  }
}

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
        <p>{checkpoint?.streamStatus?.nodeLabel ?? checkpoint?.graphState?.currentStep ?? '尚未开始'}</p>
      </div>
      <div className="panel-section">
        <strong>节点战报</strong>
        <p>
          {checkpoint?.streamStatus?.detail
            ? `${checkpoint.streamStatus.detail}${
                typeof checkpoint.streamStatus.progressPercent === 'number'
                  ? `（${checkpoint.streamStatus.progressPercent}%）`
                  : ''
              }`
            : '当前还没有新的节点战报'}
        </p>
      </div>
      <div className="panel-section">
        <strong>当前 Skill 步骤</strong>
        <p>
          {checkpoint?.currentSkillExecution
            ? `${checkpoint.currentSkillExecution.displayName} · ${checkpoint.currentSkillExecution.stepIndex}/${checkpoint.currentSkillExecution.totalSteps} · ${checkpoint.currentSkillExecution.title}`
            : '当前未进入 Skill 合同步骤'}
        </p>
      </div>
      <div className="panel-section two-column">
        <div>
          <strong>当前阶段</strong>
          <p>{getCheckpointStageLabel(checkpoint)}</p>
        </div>
        <div>
          <strong>恢复状态</strong>
          <p>{getRecoverabilitySummary(checkpoint)}</p>
        </div>
      </div>
      <div className="panel-section">
        <strong>Fallback 摘要</strong>
        <p>{getFallbackSummary(checkpoint)}</p>
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
          <span>{getAgentStateLabel(state.status)}</span>
        </div>
      ))}
    </div>
  );
}
