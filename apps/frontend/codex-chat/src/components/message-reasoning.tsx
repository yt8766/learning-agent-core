import { useEffect, useState } from 'react';

import type { CodexChatMessage } from '../types/chat';
import { ChevronDownIcon, SparklesIcon } from './chatbot-icons';

function reasoningLabel(message: CodexChatMessage, streaming?: boolean) {
  if (streaming) {
    return '思考中';
  }

  if (message.thinkingDurationMs) {
    return `已思考 ${Math.max(1, Math.round(message.thinkingDurationMs / 1000))} 秒`;
  }

  return '已思考';
}

export function MessageReasoning({ message, streaming }: { message: CodexChatMessage; streaming?: boolean }) {
  const [hasStreamed, setHasStreamed] = useState(Boolean(streaming));
  const defaultOpen = streaming || hasStreamed;

  useEffect(() => {
    if (streaming) {
      setHasStreamed(true);
    }
  }, [streaming]);

  if (!message.reasoning) {
    return null;
  }

  return (
    <details className="codex-reasoning" data-testid="message-reasoning" open={defaultOpen}>
      <summary className="codex-reasoning-summary">
        <span className="codex-reasoning-mark" aria-hidden="true">
          <SparklesIcon className={streaming ? 'codex-reasoning-spinner' : undefined} />
        </span>
        <span>{reasoningLabel(message, streaming)}</span>
        <ChevronDownIcon className="codex-reasoning-chevron" />
      </summary>
      {message.reasoning && <div className="codex-reasoning-content">{message.reasoning}</div>}
    </details>
  );
}
