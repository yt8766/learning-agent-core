import { Space, Tag, Typography } from 'antd';

import type { ChatMessage, KnowledgeChatStreamState } from '../../types/api';
import type { summarizeStreamDiagnostics } from './chat-lab-diagnostics';
import { formatStreamPhase } from './chat-lab-diagnostics';

export function ChatLabStatusLine({
  chatLabError,
  error,
  feedbackMessage,
  knowledgeBasesError,
  loading,
  streamDiagnostics,
  streamState
}: {
  chatLabError: Error | null;
  error: Error | null;
  feedbackMessage: ChatMessage | null;
  knowledgeBasesError: Error | null;
  loading: boolean;
  streamDiagnostics?: ReturnType<typeof summarizeStreamDiagnostics>;
  streamState: KnowledgeChatStreamState;
}) {
  return (
    <div className="knowledge-chat-status-line">
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      {knowledgeBasesError ? <Typography.Text type="danger">{knowledgeBasesError.message}</Typography.Text> : null}
      {chatLabError && chatLabError !== knowledgeBasesError ? (
        <Typography.Text type="danger">{chatLabError.message}</Typography.Text>
      ) : null}
      {feedbackMessage ? <Typography.Text type="success">反馈已记录</Typography.Text> : null}
      {loading && streamState.phase !== 'idle' ? (
        <Typography.Text type="secondary">
          {formatStreamPhase(streamState.phase)} · {streamState.events.length} events
        </Typography.Text>
      ) : null}
      {streamDiagnostics ? (
        <Space wrap>
          {streamDiagnostics.planner ? <Tag>{streamDiagnostics.planner}</Tag> : null}
          {streamDiagnostics.selectionReason ? (
            <Typography.Text>{streamDiagnostics.selectionReason}</Typography.Text>
          ) : null}
          {streamDiagnostics.confidence ? <Tag>{streamDiagnostics.confidence}</Tag> : null}
          {streamDiagnostics.searchMode ? <Tag>{streamDiagnostics.searchMode}</Tag> : null}
          {streamDiagnostics.retrievalMode ? <Tag>{streamDiagnostics.retrievalMode}</Tag> : null}
          {typeof streamDiagnostics.finalHitCount === 'number' ? (
            <Tag>{streamDiagnostics.finalHitCount} hits</Tag>
          ) : null}
          {streamDiagnostics.executedQuery ? (
            <Typography.Text>{streamDiagnostics.executedQuery}</Typography.Text>
          ) : null}
        </Space>
      ) : null}
    </div>
  );
}
