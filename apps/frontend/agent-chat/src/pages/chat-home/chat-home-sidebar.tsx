import { Space, Tag, Typography } from 'antd';

import type { useChatSession } from '@/hooks/use-chat-session';
import { formatSessionTime, getSessionStatusLabel } from '@/hooks/use-chat-session';

const { Paragraph, Text, Title } = Typography;

interface ChatHomeSidebarProps {
  chat: ReturnType<typeof useChatSession>;
}

export function ChatHomeSidebar({ chat }: ChatHomeSidebarProps) {
  return (
    <>
      <div className="chatx-brand">
        <div className="chatx-brand__badge" aria-hidden="true">
          OC
        </div>
        <div className="chatx-brand__copy">
          <Title level={2}>Agent Chat</Title>
          <Text className="chatx-brand__subcopy">Single frontline session</Text>
        </div>
      </div>

      <section className="chatx-session-rail">
        <div className="chatx-session-rail__header">
          <Text className="chatx-session-rail__eyebrow">当前会话</Text>
          {chat.activeSession ? <Tag>{getSessionStatusLabel(chat.activeSession.status)}</Tag> : null}
        </div>
        <Title level={4} className="chatx-session-rail__title">
          {chat.activeSession?.title ?? '正在准备会话'}
        </Title>
        <Paragraph className="chatx-session-rail__desc">
          这里先收敛成单会话入口。聊天、审批、技能补强、思考链和运行态都围绕这一条前线线程展开。
        </Paragraph>
        <Space wrap size={8} className="chatx-session-rail__meta">
          {chat.activeSession?.updatedAt ? (
            <Tag color="blue">更新于 {formatSessionTime(chat.activeSession.updatedAt)}</Tag>
          ) : null}
          {chat.checkpoint?.chatRoute ? <Tag color="purple">{chat.checkpoint.chatRoute.flow}</Tag> : null}
          {chat.checkpoint?.currentMinistry ? <Tag color="cyan">{chat.checkpoint.currentMinistry}</Tag> : null}
        </Space>
      </section>

      <button type="button" className="chatx-new-chat" onClick={() => chat.createNewSession()}>
        <span className="chatx-new-chat__icon">+</span>
        <span className="chatx-new-chat__label">开启新的当前会话</span>
      </button>
    </>
  );
}
