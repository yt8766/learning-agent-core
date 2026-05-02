import { DownOutlined, LoadingOutlined, UpOutlined } from '@ant-design/icons';
import { useState } from 'react';

import type { AssistantThinkingState } from './chat-message-adapter-helpers';

export interface MessageThinkingPanelProps {
  content: string;
  state: AssistantThinkingState;
  durationLabel?: string;
}

export function MessageThinkingPanel({ content, state, durationLabel }: MessageThinkingPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (!content.trim() && state === 'none') {
    return null;
  }

  const title = state === 'streaming' ? '思考中' : durationLabel ? `已思考（用时 ${durationLabel}）` : '已思考';

  return (
    <section className={`chatx-thinking-panel is-${state}`} aria-label={title}>
      <button
        type="button"
        className="chatx-thinking-panel__header"
        aria-expanded={expanded}
        aria-label={expanded ? '收起思考内容' : '展开思考内容'}
        onClick={() => setExpanded(value => !value)}
      >
        <span className="chatx-thinking-panel__mark" aria-hidden="true">
          {state === 'streaming' ? <LoadingOutlined /> : null}
        </span>
        <span className="chatx-thinking-panel__title">{title}</span>
        <span className="chatx-thinking-panel__toggle" aria-hidden="true">
          {expanded ? <UpOutlined /> : <DownOutlined />}
        </span>
      </button>
      {expanded && content.trim() ? <div className="chatx-thinking-panel__body">{content}</div> : null}
    </section>
  );
}
