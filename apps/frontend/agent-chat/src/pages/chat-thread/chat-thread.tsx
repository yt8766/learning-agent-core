import type { ChatMessageRecord } from '@/types/chat';
import { getMessageRoleLabel, formatSessionTime } from '@/hooks/use-chat-session';

interface ChatThreadProps {
  messages: ChatMessageRecord[];
}

const AGENT_LABELS: Record<string, string> = {
  manager: '主 Agent',
  research: 'Research Agent',
  executor: 'Executor Agent',
  reviewer: 'Reviewer Agent'
};

function getLinkedAgentLabel(message: ChatMessageRecord) {
  if (!message.linkedAgent) {
    return '';
  }

  return AGENT_LABELS[message.linkedAgent] ?? message.linkedAgent;
}

export function ChatThread({ messages }: ChatThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="welcome-block">
        <h1>提出问题</h1>
      </div>
    );
  }

  return (
    <div className="message-stream">
      {messages.map(message => {
        const linkedAgentLabel = getLinkedAgentLabel(message);

        return (
          <article key={message.id} className={`stream-message ${message.role}`}>
            <div className="stream-avatar">
              {message.role === 'assistant' ? 'A' : message.role === 'user' ? '你' : '系'}
            </div>
            <div className="stream-content">
              <header>
                <strong>{getMessageRoleLabel(message.role)}</strong>
                <span>{formatSessionTime(message.createdAt)}</span>
              </header>
              {linkedAgentLabel ? <small>{linkedAgentLabel}</small> : null}
              <p>{message.content}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
