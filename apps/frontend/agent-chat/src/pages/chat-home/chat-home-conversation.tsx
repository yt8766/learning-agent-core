import { AimOutlined, GlobalOutlined, PaperClipOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useEffect, useState } from 'react';

import { getSessionStatusLabel, useChatSession } from '@/hooks/use-chat-session';
import { ConversationAnchorRail } from './chat-home-anchor-rail';
import { buildConversationAnchors } from './chat-home-anchor-rail-helpers';
import { buildSubmitMessage } from './chat-home-submit';

const { Text, Title } = Typography;

interface ConversationProps {
  onSend: ReturnType<typeof useChatSession>['sendMessage'];
  onCancel: ReturnType<typeof useChatSession>['cancelActiveSession'];
  loading: boolean;
}

interface ActiveConversationProps extends ConversationProps {
  activeTitle: string;
  activeStatus?: string;
  bubbleItems: BubbleItemType[];
  anchors: ReturnType<typeof buildConversationAnchors>;
}

export function ActiveConversation(props: ActiveConversationProps) {
  return (
    <div className="chatx-conversation">
      <header className="chatx-conversation__header">
        <div>
          <Title level={2}>{props.activeTitle}</Title>
          {props.activeStatus ? (
            <Text className="chatx-conversation__mode">{getSessionStatusLabel(props.activeStatus)}</Text>
          ) : null}
        </div>
      </header>

      <ConversationAnchorRail anchors={props.anchors} />

      <div className="chatx-conversation__stream">
        <Bubble.List items={props.bubbleItems} autoScroll className="chatx-bubble-list" />
        <div className="chatx-conversation__composer">
          <ChatComposer onSend={props.onSend} onCancel={props.onCancel} loading={props.loading} active />
        </div>
      </div>
    </div>
  );
}

export function EmptyConversation(props: ConversationProps) {
  return (
    <div className="chatx-empty-conversation">
      <div className="chatx-empty-conversation__hero">
        <div className="chatx-empty-conversation__title">
          <span className="chatx-brand-mark" aria-hidden="true" />
          <Title level={1}>开始新对话</Title>
        </div>
        <ChatComposer onSend={props.onSend} onCancel={props.onCancel} loading={props.loading} />
      </div>
    </div>
  );
}

function ChatComposer(props: ConversationProps & { active?: boolean }) {
  const [draft, setDraft] = useState('');
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  useEffect(() => {
    setDraft('');
    setDeepThinkingEnabled(false);
  }, []);

  return (
    <div className={`chatx-agent-composer ${props.active ? 'is-active-thread' : 'is-empty-thread'}`}>
      <Sender
        className="chatx-sender"
        value={draft}
        onChange={setDraft}
        onSubmit={value => {
          const nextValue = value.trim();
          if (!nextValue) {
            return;
          }
          const activeModes = [deepThinkingEnabled ? 'plan' : '', webSearchEnabled ? 'browse' : ''].filter(Boolean);
          const outbound = buildSubmitMessage(nextValue, activeModes);
          setDraft('');
          props.onSend(outbound);
        }}
        onCancel={props.onCancel}
        suffix={false}
        loading={props.loading}
        placeholder="给 Agent Chat 发送消息"
        autoSize={{ minRows: 2, maxRows: 3 }}
        footer={actionNode => (
          <div className="chatx-sender-footer">
            <div className="chatx-sender-footer__left">
              <button
                type="button"
                className={`chatx-sender-chip${deepThinkingEnabled ? ' is-active' : ''}`}
                aria-pressed={deepThinkingEnabled}
                onClick={() => setDeepThinkingEnabled(enabled => !enabled)}
              >
                <AimOutlined aria-hidden="true" />
                <span>深度思考</span>
              </button>
              <button
                type="button"
                className={`chatx-sender-chip${webSearchEnabled ? ' is-active' : ''}`}
                aria-pressed={webSearchEnabled}
                onClick={() => setWebSearchEnabled(enabled => !enabled)}
              >
                <GlobalOutlined aria-hidden="true" />
                <span>智能搜索</span>
              </button>
            </div>
            <div className="chatx-sender-footer__right">
              <button type="button" className="chatx-sender-attach" aria-label="上传文件">
                <PaperClipOutlined aria-hidden="true" />
              </button>
              {actionNode}
            </div>
          </div>
        )}
      />
      <Text className="chatx-ai-disclaimer">内容由 AI 生成，请仔细甄别</Text>
    </div>
  );
}
