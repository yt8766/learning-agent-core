import type { ReactNode } from 'react';
import { useState } from 'react';
import { Prompts, XProvider } from '@ant-design/x';
import { ConfigProvider, Input, Modal } from 'antd';

import { CodexComposer } from './codex-composer';
import { CodexSidebar } from './codex-sidebar';
import { AssistantMessage } from './assistant-message';
import type { CodexChatSessionState } from '../hooks/use-codex-chat-session';

interface CodexChatLayoutProps {
  chat: CodexChatSessionState;
  defaultSidebarCollapsed?: boolean;
}

const suggestions = [
  '创建一个设置面板 React 组件',
  '帮我排查流式 API 响应问题',
  '把多 Agent 工作流拆成计划',
  '像资深工程师一样审查这个产品想法'
];

export function CodexChatLayout({ chat, defaultSidebarCollapsed = false }: CodexChatLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultSidebarCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 10,
          colorPrimary: '#171717',
          fontFamily:
            'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
        }
      }}
    >
      <XProvider>
        <main
          className={`chatbot-shell${sidebarCollapsed ? ' chatbot-shell-sidebar-collapsed' : ''}${
            mobileSidebarOpen ? ' chatbot-shell-sidebar-mobile-open' : ''
          }`}
        >
          <CodexSidebar
            chat={chat}
            collapsed={sidebarCollapsed}
            onCloseMobile={() => setMobileSidebarOpen(false)}
            onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
          />

          <section className="chatbot-main">
            <div className="chatbot-thread">
              {chat.activeMessages.length === 0 ? (
                <div className="chatbot-empty-state">
                  <div className="chatbot-greeting">
                    <h1>我能帮你做什么？</h1>
                    <p>提问、写代码，或者一起梳理想法。</p>
                  </div>
                  <Prompts
                    className="chatbot-suggestions"
                    items={suggestions.map(label => ({ key: label, label }))}
                    onItemClick={(info: { data: { label?: ReactNode } }) =>
                      void chat.sendMessage(String(info.data.label))
                    }
                  />
                </div>
              ) : (
                <div className="chatbot-bubble-list" aria-label="消息列表">
                  <div className="chatbot-message-stack">
                    {chat.activeMessages.map(({ id, message, status }) =>
                      message.role === 'assistant' ? (
                        <AssistantMessage
                          key={id}
                          message={message}
                          streaming={status === 'loading' || status === 'updating'}
                        />
                      ) : (
                        <article key={id} className="chatbot-user-row" data-role={message.role}>
                          <div className="chatbot-user-message">{message.content}</div>
                        </article>
                      )
                    )}
                    <div className="chatbot-scroll-anchor" />
                  </div>
                </div>
              )}
            </div>

            <CodexComposer
              isRequesting={chat.isRequesting}
              onCancel={chat.cancelStreamRequest}
              onSubmit={(content, modelId) => void chat.sendMessage(content, modelId)}
              streamError={chat.streamError}
            />
          </section>

          <Modal
            title="重命名对话"
            open={Boolean(chat.renameTarget)}
            okText="保存"
            cancelText="取消"
            onCancel={() => chat.setRenameTarget(null)}
            onOk={() => void chat.renameConversation()}
          >
            <Input
              autoFocus
              maxLength={32}
              value={chat.renameValue}
              onChange={event => chat.setRenameValue(event.target.value)}
              onPressEnter={() => void chat.renameConversation()}
              placeholder="输入新的对话标题"
            />
          </Modal>
        </main>
      </XProvider>
    </ConfigProvider>
  );
}
