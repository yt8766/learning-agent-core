import { AimOutlined, ArrowDownOutlined, PaperClipOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getSessionStatusLabel, useChatSession } from '@/hooks/use-chat-session';
import { ConversationAnchorRail } from './chat-home-anchor-rail';
import { buildConversationAnchors } from './chat-home-anchor-rail-helpers';
import { buildSubmitMessage } from './chat-home-submit';

const { Text, Title } = Typography;

interface ConversationProps {
  onSend: ReturnType<typeof useChatSession>['sendMessage'];
  onCancel: ReturnType<typeof useChatSession>['cancelActiveSession'];
  loading: boolean;
  placeholder?: string;
}

interface ActiveConversationProps extends ConversationProps {
  activeTitle: string;
  activeStatus?: string;
  bubbleItems: BubbleItemType[];
  anchors: ReturnType<typeof buildConversationAnchors>;
}

export function ActiveConversation(props: ActiveConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollEl = scrollRef.current;
    if (!sentinel || !scrollEl) return;
    const observer = new IntersectionObserver(([entry]) => setShowScrollFab(!entry.isIntersecting), {
      root: scrollEl,
      threshold: 0.1
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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

      {/* 锚点为 fixed；主列为「滚动消息区 + 底部 Composer」，避免 Composer 占用滚动文档流 */}
      <div className="chatx-conversation__body">
        <ConversationAnchorRail anchors={props.anchors} />

        <div className="chatx-conversation__column">
          <div className="chatx-conversation__stream">
            <div className="chatx-conversation__stream-scroll" ref={scrollRef}>
              <Bubble.List items={props.bubbleItems} autoScroll className="chatx-bubble-list" />
              <div ref={sentinelRef} className="chatx-conversation__sentinel" aria-hidden="true" />
              {showScrollFab ? (
                <button
                  type="button"
                  className="chatx-conversation__scroll-fab"
                  onClick={scrollToBottom}
                  aria-label="滚动到底部"
                >
                  <ArrowDownOutlined />
                </button>
              ) : null}
            </div>
          </div>
          <div className="chatx-conversation__composer">
            <ChatComposer
              onSend={props.onSend}
              onCancel={props.onCancel}
              loading={props.loading}
              placeholder={props.placeholder}
              active
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyConversation(props: ConversationProps) {
  return (
    <div className="chatx-empty-conversation">
      <div className="chatx-empty-conversation__hero">
        <div className="chatx-empty-conversation__intro">
          <p className="chatx-empty-conversation__tagline">从一条消息起步</p>
          <div className="chatx-empty-conversation__title">
            <span className="chatx-brand-mark" aria-hidden="true" />
            <Title level={1}>你今天想搞定什么？</Title>
          </div>
          <span className="chatx-empty-conversation__hint">支持长对话、推理过程与执行任务，侧边栏可随时切换会话。</span>
        </div>
        <ChatComposer
          onSend={props.onSend}
          onCancel={props.onCancel}
          loading={props.loading}
          placeholder={props.placeholder}
        />
      </div>
    </div>
  );
}

function ChatComposer(props: ConversationProps & { active?: boolean }) {
  const [draft, setDraft] = useState('');
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);

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
          const activeModes = [deepThinkingEnabled ? 'plan' : ''].filter(Boolean);
          const outbound = buildSubmitMessage(nextValue, activeModes);
          setDraft('');
          props.onSend(outbound);
        }}
        onCancel={props.onCancel}
        suffix={false}
        loading={props.loading}
        placeholder={props.placeholder ?? '给 Agent Chat 发送消息'}
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
