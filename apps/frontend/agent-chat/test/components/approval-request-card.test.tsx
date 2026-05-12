import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({ content, className }: { content: string; className?: string }) => (
    <div className={className}>{content}</div>
  )
}));

import { ApprovalRequestCard } from '@/components/chat-message-cards/approval-request-card';

describe('ApprovalRequestCard', () => {
  const baseCard = {
    type: 'approval_request' as const,
    intent: 'write_file',
    toolName: 'write_local_file',
    reason: 'Needs approval',
    status: 'pending' as const,
    displayStatus: 'pending' as const,
    isPrimaryActionAvailable: true,
    approvalScope: 'once' as const
  };

  it('renders standard approval card with header and actions', () => {
    const html = renderToStaticMarkup(<ApprovalRequestCard card={baseCard} content="Content here" />);

    expect(html).toContain('操作确认');
    expect(html).toContain('允许继续执行此操作');
    expect(html).toContain('允许本次');
    expect(html).toContain('本会话允许');
    expect(html).toContain('永久允许');
    expect(html).toContain('拒');
    expect(html).toContain('添加说明');
  });

  it('renders runtime governance mode when watchdog and supplemental-input', () => {
    const card = {
      ...baseCard,
      interactionKind: 'supplemental-input' as const,
      watchdog: true
    };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('运行时治理中断');
    expect(html).toContain('兵部运行时操作需要处理');
    expect(html).toContain('runtime-governance');
    expect(html).toContain('watchdog');
  });

  it('renders risk level tag', () => {
    const card = { ...baseCard, riskLevel: 'high' };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('高风险');
  });

  it('renders risk reason when present', () => {
    const card = { ...baseCard, riskReason: 'Dangerous command' };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('Dangerous command');
  });

  it('falls back to content when reason is absent', () => {
    const card = { ...baseCard, reason: undefined };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Fallback content" />);

    expect(html).toContain('Fallback content');
  });

  it('shows requestedBy tag when present', () => {
    const card = { ...baseCard, requestedBy: 'gongbu-code' };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('gongbu-code');
    expect(html).toContain('来源部门');
  });

  it('renders command preview when present', () => {
    const card = { ...baseCard, commandPreview: 'rm -rf /tmp/test' };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('rm -rf /tmp/test');
    expect(html).toContain('命令预览');
  });

  it('renders preview items when present', () => {
    const card = {
      ...baseCard,
      preview: [{ label: 'Path', value: '/tmp/test' }]
    };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('将要执行');
    expect(html).toContain('/tmp/test');
  });

  it('renders recommended actions when present', () => {
    const card = {
      ...baseCard,
      recommendedActions: ['Check logs first', 'Run tests']
    };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('推荐动作');
    expect(html).toContain('Check logs first');
  });

  it('renders resume strategy when present', () => {
    const card = { ...baseCard, resumeStrategy: 'command' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('恢复方式');
  });

  it('renders interrupt source when present', () => {
    const card = { ...baseCard, interruptSource: 'graph' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('中断来源');
  });

  it('renders interrupt mode when present', () => {
    const card = { ...baseCard, interruptMode: 'blocking' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('中断模式');
  });

  it('renders runtime governance reason code when present', () => {
    const card = { ...baseCard, runtimeGovernanceReasonCode: 'timeout' };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('治理原因');
  });

  it('disables actions when isPrimaryActionAvailable is false', () => {
    const card = { ...baseCard, isPrimaryActionAvailable: false };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('disabled');
  });

  it('disables actions when status is approved', () => {
    const card = { ...baseCard, status: 'approved' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('disabled');
  });

  it('disables actions when status is rejected', () => {
    const card = { ...baseCard, status: 'rejected' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('disabled');
  });

  it('disables actions when status is allowed', () => {
    const card = { ...baseCard, status: 'allowed' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('disabled');
  });

  it('shows session approval scope label', () => {
    const card = { ...baseCard, approvalScope: 'session' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('本会话');
  });

  it('shows always approval scope label', () => {
    const card = { ...baseCard, approvalScope: 'always' as const };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('永远允许');
  });

  it('renders reasonCode tag when present', () => {
    const card = { ...baseCard, reasonCode: 'requires_approval_destructive' };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('检测到破坏性操作');
  });

  it('renders riskCode tag when different from reasonCode', () => {
    const card = { ...baseCard, reasonCode: 'requires_approval_destructive', riskCode: 'requires_approval_high_risk' };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('命中高危动作策略');
  });

  it('does not render riskCode tag when same as reasonCode', () => {
    const card = {
      ...baseCard,
      reasonCode: 'requires_approval_destructive',
      riskCode: 'requires_approval_destructive'
    };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    const matches = html.match(/检测到破坏性操作/g) ?? [];
    // reasonCode tag shows once but riskCode should NOT show since it matches reasonCode
    expect(matches.length).toBe(1);
  });

  it('renders tool fallback text when toolName is missing', () => {
    const card = { ...baseCard, toolName: undefined };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).toContain('待确认工具');
  });

  it('does not render sections when optional fields are absent', () => {
    const card = {
      type: 'approval_request' as const,
      intent: 'test',
      status: 'pending' as const,
      displayStatus: 'pending' as const,
      isPrimaryActionAvailable: true
    };
    const html = renderToStaticMarkup(<ApprovalRequestCard card={card} content="Content" />);

    expect(html).not.toContain('命令预览');
    expect(html).not.toContain('将要执行');
    expect(html).not.toContain('推荐动作');
    expect(html).not.toContain('来源部门');
    expect(html).not.toContain('恢复方式');
    expect(html).not.toContain('中断来源');
    expect(html).not.toContain('中断模式');
    expect(html).not.toContain('治理原因');
  });
});
