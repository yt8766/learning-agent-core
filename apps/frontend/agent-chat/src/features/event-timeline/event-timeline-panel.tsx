import type { ChatEventRecord } from '@/types/chat';
import { formatSessionTime } from '@/hooks/use-chat-session';

interface EventTimelinePanelProps {
  events: ChatEventRecord[];
}

const EVENT_LABELS: Record<string, string> = {
  session_started: '会话启动',
  user_message: '用户消息',
  manager_planned: '主 Agent 规划',
  subtask_dispatched: '任务分派',
  research_progress: 'Research 进展',
  tool_selected: '工具选择',
  tool_called: '工具调用',
  interrupt_pending: '阻塞式中断确认',
  interrupt_resumed: '中断已恢复',
  interrupt_rejected_with_feedback: '中断已打回',
  approval_required: '阻塞式中断确认',
  approval_resolved: '中断已恢复',
  approval_rejected_with_feedback: '中断已打回',
  review_completed: 'Review 完成',
  learning_pending_confirmation: '等待学习确认',
  learning_confirmed: '学习已确认',
  conversation_compacted: '对话已压缩',
  assistant_message: 'Agent 回复',
  session_finished: '会话完成',
  session_failed: '会话失败'
};

const AGENT_LABELS: Record<string, string> = {
  manager: '主 Agent',
  research: 'Research Agent',
  executor: 'Executor Agent',
  reviewer: 'Reviewer Agent'
};

function getInterruptEventLabel(eventItem: ChatEventRecord) {
  const payload = eventItem.payload ?? {};
  const interruptMode =
    payload.interruptMode === 'blocking' || payload.interruptMode === 'non-blocking'
      ? payload.interruptMode
      : undefined;

  if (eventItem.type === 'approval_required' || eventItem.type === 'interrupt_pending') {
    if (payload.interactionKind === 'plan-question') {
      return '等待方案澄清';
    }
    return interruptMode === 'non-blocking' ? '非阻塞式中断建议' : '阻塞式中断确认';
  }
  if (eventItem.type === 'approval_resolved' || eventItem.type === 'interrupt_resumed') {
    return payload.interactionKind === 'plan-question' ? '方案已更新' : '中断已恢复';
  }
  if (eventItem.type === 'approval_rejected_with_feedback' || eventItem.type === 'interrupt_rejected_with_feedback') {
    return payload.interactionKind === 'plan-question' ? '方案已打回' : '中断已打回';
  }

  return EVENT_LABELS[eventItem.type] ?? eventItem.type;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getEventSummary(eventItem: ChatEventRecord) {
  const payload = eventItem.payload ?? {};
  const candidateCount = Array.isArray(payload.candidates) ? payload.candidates.length : 0;
  const condensedMessageCount = typeof payload.condensedMessageCount === 'number' ? payload.condensedMessageCount : 0;

  return (
    asString(payload.content) ||
    asString(payload.summary) ||
    asString(payload.reason) ||
    asString(payload.error) ||
    (condensedMessageCount > 0 ? `已压缩 ${condensedMessageCount} 条较早消息` : '') ||
    (candidateCount > 0 ? `产生 ${candidateCount} 个学习候选` : '') ||
    '事件已记录'
  );
}

function getEventMeta(eventItem: ChatEventRecord) {
  const payload = eventItem.payload ?? {};
  const parts = [
    asString(payload.from) ? `来源：${AGENT_LABELS[asString(payload.from)] ?? asString(payload.from)}` : '',
    asString(payload.node) ? `节点：${asString(payload.node)}` : '',
    asString(payload.intent) ? `意图：${asString(payload.intent)}` : '',
    asString(payload.interactionKind) === 'plan-question' ? '交互：计划提问' : '',
    asString(payload.decision) ? `结果：${asString(payload.decision)}` : '',
    payload.interruptSource === 'graph' ? '中断来源：图内' : '',
    payload.interruptSource === 'tool' ? '中断来源：工具内' : '',
    payload.interruptMode === 'blocking' ? '模式：阻塞式' : '',
    payload.interruptMode === 'non-blocking' ? '模式：非阻塞式' : '',
    payload.resumeStrategy === 'command' ? '恢复：图中断恢复' : '',
    payload.resumeStrategy === 'approval-recovery' ? '恢复：兼容恢复链路' : ''
  ].filter(Boolean);

  return parts.join(' · ');
}

export function EventTimelinePanel({ events }: EventTimelinePanelProps) {
  return (
    <div className="panel-card events-card">
      <div className="panel-header">
        <h3>事件流</h3>
        <span>{events.length}</span>
      </div>
      <div className="event-list">
        {events.length === 0 ? <p className="panel-empty">执行后会出现事件流</p> : null}
        {events
          .slice()
          .reverse()
          .map(eventItem => {
            const summary = getEventSummary(eventItem);
            const meta = getEventMeta(eventItem);

            return (
              <article key={eventItem.id} className="event-row">
                <header>
                  <strong>{getInterruptEventLabel(eventItem)}</strong>
                  <span>{formatSessionTime(eventItem.at)}</span>
                </header>
                <p>{summary}</p>
                {meta ? <small>{meta}</small> : null}
              </article>
            );
          })}
      </div>
    </div>
  );
}
