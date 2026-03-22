import type { ChatEventRecord } from '../../types/chat';
import { formatSessionTime } from '../../hooks/use-chat-session';

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
  approval_required: '等待审批',
  approval_resolved: '审批完成',
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
    asString(payload.decision) ? `结果：${asString(payload.decision)}` : ''
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
                  <strong>{EVENT_LABELS[eventItem.type] ?? eventItem.type}</strong>
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
