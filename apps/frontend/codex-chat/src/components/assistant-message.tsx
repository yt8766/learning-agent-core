import { CheckCircleOutlined, DownOutlined, Loading3QuartersOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { XMarkdown } from '@ant-design/x-markdown';
import { Tag } from 'antd';

import type { CodexChatMessage, CodexStepStatus, CodexThoughtStep } from '@/types/chat';

function statusIcon(status: CodexStepStatus) {
  if (status === 'completed') {
    return <CheckCircleOutlined />;
  }

  if (status === 'running') {
    return <Loading3QuartersOutlined spin />;
  }

  return <ThunderboltOutlined />;
}

function thinkingLabel(message: CodexChatMessage, streaming?: boolean) {
  if (streaming) {
    return '思考中';
  }

  if (message.thinkingDurationMs) {
    return `已思考（用时 ${Math.max(1, Math.round(message.thinkingDurationMs / 1000))} 秒）`;
  }

  return '已思考';
}

function fallbackSteps(streaming?: boolean): CodexThoughtStep[] {
  return [
    {
      id: 'context',
      title: '理解问题',
      description: '整理当前会话上下文与用户意图。',
      status: 'completed' as const
    },
    {
      id: 'answer',
      title: streaming ? '组织回复中' : '完成回答',
      description: streaming ? '把推理结果转成可读回复。' : '已将结论收敛到本次回复。',
      status: streaming ? ('running' as const) : ('completed' as const)
    }
  ];
}

export function AssistantMessage({ message, streaming }: { message: CodexChatMessage; streaming?: boolean }) {
  const steps = message.steps?.length ? message.steps : fallbackSteps(streaming);

  return (
    <article className="codex-assistant-message">
      <details className="codex-thinking" open={streaming || message.approvalPending}>
        <summary className="codex-thinking-summary">
          <span className="codex-thinking-mark">
            <ThunderboltOutlined />
          </span>
          <span>{thinkingLabel(message, streaming)}</span>
          <DownOutlined className="codex-thinking-chevron" />
        </summary>
        <div className="codex-thinking-body">
          {message.reasoning && <p className="codex-thinking-note">{message.reasoning}</p>}
          <ol className="codex-step-list">
            {steps.map(step => (
              <li key={step.id} className={`codex-step codex-step-${step.status}`}>
                <span className="codex-step-icon">{statusIcon(step.status)}</span>
                <span className="codex-step-copy">
                  <strong>{step.title}</strong>
                  {step.description && <small>{step.description}</small>}
                </span>
                {step.agentLabel && <Tag>{step.agentLabel}</Tag>}
              </li>
            ))}
          </ol>
        </div>
      </details>

      <div className="codex-markdown">
        <XMarkdown
          content={message.content || (streaming ? '正在组织回答...' : '')}
          streaming={streaming ? { hasNextChunk: true } : { hasNextChunk: false }}
        />
      </div>

      {message.sources && message.sources.length > 0 && (
        <div className="codex-source-strip">
          {message.sources.map(source => (
            <a key={source.id} href={source.href} target="_blank" rel="noreferrer">
              {source.title}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
