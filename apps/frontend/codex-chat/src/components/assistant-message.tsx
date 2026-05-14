import { XMarkdown } from '@ant-design/x-markdown';
import { Button } from 'antd';

import type { CodexChatMessage } from '../types/chat';
import { SparklesIcon } from './chatbot-icons';
import { MessageActions } from './message-actions';
import { MessageReasoning } from './message-reasoning';

function ApprovalCard() {
  return (
    <section className="codex-approval-card" aria-label="等待人工审批">
      <div className="codex-approval-copy">
        <strong>等待人工审批</strong>
        <span>这一步会执行受控操作，需要你确认后继续。</span>
      </div>
      <div className="codex-approval-actions">
        <Button type="primary">执行</Button>
        <Button>取消</Button>
      </div>
    </section>
  );
}

export function AssistantMessage({ message, streaming }: { message: CodexChatMessage; streaming?: boolean }) {
  const isThinking = streaming && !message.content.trim() && !message.reasoning?.trim();

  return (
    <article className="codex-preview-message" data-role="assistant" data-testid="message-assistant">
      <div className="codex-assistant-avatar" aria-hidden="true">
        <SparklesIcon />
      </div>

      <div className="codex-assistant-stack">
        {isThinking ? (
          <div className="codex-thinking-placeholder">Thinking...</div>
        ) : (
          <>
            <MessageReasoning message={message} streaming={streaming} />

            {message.approvalPending && <ApprovalCard />}

            <div className="codex-message-content" data-testid="message-content">
              <XMarkdown
                content={message.content}
                streaming={streaming ? { hasNextChunk: true } : { hasNextChunk: false }}
              />
            </div>

            <MessageActions content={message.content} />
          </>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="codex-source-strip">
            {message.sources.map(source => (
              <a key={source.id} href={source.href} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
