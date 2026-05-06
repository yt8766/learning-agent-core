import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { renderStructuredMessageCard } from '@/components/chat-message-cards';
import type { ChatMessageRecord } from '@/types/chat';

vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({
    content,
    className,
    streaming,
    components
  }: {
    content: string;
    className?: string;
    streaming?: Record<string, unknown>;
    components?: Record<string, React.ComponentType<{ children?: React.ReactNode }>>;
  }) => {
    const Sup = components?.sup;
    const parts = content.split(/(<sup>\s*\d+\s*<\/sup>)/g).filter(Boolean);
    return (
      <div className={className} data-streaming={JSON.stringify(streaming ?? null)}>
        {parts.map((part, index) => {
          const match = part.match(/^<sup>\s*(\d+)\s*<\/sup>$/i);
          if (match && Sup) {
            return <Sup key={index}>{match[1]}</Sup>;
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </div>
    );
  }
}));

vi.mock('@ant-design/x', async () => {
  return {
    Sources: ({
      title,
      items
    }: {
      title?: React.ReactNode;
      items?: Array<{ title: React.ReactNode; description?: React.ReactNode }>;
    }) => (
      <div>
        <div>{title}</div>
        {items?.map((item, index) => (
          <article key={index}>
            <div>{item.title}</div>
            <div>{item.description}</div>
          </article>
        ))}
      </div>
    )
  };
});

describe('chat message cards render smoke', () => {
  it('renders approval request cards with reason label and preview content', () => {
    const message: ChatMessageRecord = {
      id: 'msg-approval-1',
      sessionId: 'session-1',
      role: 'system',
      content: '需要审批',
      card: {
        type: 'approval_request',
        intent: 'write_file',
        toolName: 'write_local_file',
        reason: '路径属于敏感位置，需要审批。',
        reasonCode: 'requires_approval_destructive',
        riskLevel: 'high',
        riskCode: 'requires_approval_high_risk',
        riskReason: '命中高危命令策略，需要人工确认后才能继续。',
        commandPreview: 'rm -rf /tmp/test-artifacts',
        approvalScope: 'once',
        requestedBy: 'gongbu-code',
        interruptSource: 'graph',
        interruptMode: 'blocking',
        resumeStrategy: 'command',
        status: 'pending',
        preview: [{ label: 'Path', value: '.env.local' }]
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(renderStructuredMessageCard(message, false, {}));
    const compactHtml = html.replace(/\s+/g, '');

    expect(html).toContain('操作确认');
    expect(html).toContain('高风险');
    expect(html).toContain('write_local_file');
    expect(html).toContain('命中高危命令策略');
    expect(html).toContain('命令预览');
    expect(html).toContain('rm -rf /tmp/test-artifacts');
    expect(html).toContain('仅本次');
    expect(html).toContain('.env.local');
    expect(html).toContain('允许本次');
    expect(html).toContain('本会话允许');
    expect(html).toContain('永久允许');
    expect(compactHtml).toContain('拒绝');
    expect(html).toContain('添加说明');
    expect(html).toContain('查看详情');
    expect(html).toContain('图中断恢复');
    expect(html).toContain('图内发起');
    expect(html).toContain('阻塞式');
  });

  it('renders learning summary cards with policy, conflict and expertise metadata', () => {
    const message: ChatMessageRecord = {
      id: 'msg-learning-1',
      sessionId: 'session-1',
      role: 'system',
      content: '自动学习结果',
      card: {
        type: 'learning_summary',
        score: 0.94,
        confidence: 'high',
        notes: ['识别出稳定偏好，可自动沉淀。'],
        candidateReasons: ['基于用户稳定表达提取到输出风格偏好'],
        skippedReasons: ['单次临时要求未进入长期记忆'],
        conflictDetected: true,
        conflictTargets: ['mem_pref_output_style'],
        derivedFromLayers: ['session-compression'],
        policyMode: 'profile:personal',
        expertiseSignals: ['domain-expert'],
        skillGovernanceRecommendations: [
          {
            skillId: 'skill-product-review',
            recommendation: 'keep-lab',
            successRate: 0.82
          }
        ],
        recommendedCount: 1,
        autoConfirmCount: 1
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(renderStructuredMessageCard(message, false, {}));

    expect(html).toContain('Learning');
    expect(html).toContain('沉淀理由');
    expect(html).toContain('跳过原因');
    expect(html).toContain('冲突检测');
    expect(html).toContain('mem_pref_output_style');
    expect(html).toContain('profile:personal');
    expect(html).toContain('domain-expert');
    expect(html).toContain('skill-product-review');
  });

  it('renders control notice cards with lightweight status copy', () => {
    const message: ChatMessageRecord = {
      id: 'msg-control-1',
      sessionId: 'session-1',
      role: 'system',
      content: '已恢复执行',
      card: {
        type: 'control_notice',
        tone: 'success',
        label: '已恢复执行'
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(renderStructuredMessageCard(message, false, {}));

    expect(html).toContain('chatx-control-notice');
    expect(html).toContain('已恢复执行');
    expect(html).toContain('已恢复执行');
  });

  it('configures assistant Markdown with Ant Design X streaming animation while generating', () => {
    const message: ChatMessageRecord = {
      id: 'msg-streaming-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '正在生成一段包含 [链接](https://example',
      createdAt: '2026-05-04T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(renderStructuredMessageCard(message, true, {}));

    expect(html).toContain('x-markdown-light');
    expect(html).toContain('&quot;hasNextChunk&quot;:true');
    expect(html).toContain('&quot;enableAnimation&quot;:true');
    expect(html).toContain('&quot;fadeDuration&quot;:400');
    expect(html).not.toContain('&quot;tail&quot;');
    expect(html).not.toContain('&quot;incompleteMarkdownComponentMap&quot;');
  });

  it('renders compression summary cards as compact divider hints', () => {
    const message: ChatMessageRecord = {
      id: 'msg-compress-1',
      sessionId: 'session-1',
      role: 'system',
      content: '为控制上下文长度，已将较早消息压缩为摘要。',
      card: {
        type: 'compression_summary',
        summary: '我们先讨论了计划模式和技能安装，然后收敛到前端可见性与压缩体验。',
        condensedMessageCount: 12,
        condensedCharacterCount: 1800,
        totalCharacterCount: 6200,
        previewMessages: [
          { role: 'user', content: '先讨论计划模式。' },
          { role: 'assistant', content: '再收敛技能安装。' }
        ],
        trigger: 'message_count',
        source: 'llm'
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(renderStructuredMessageCard(message, false, {}));

    expect(html).toContain('chatx-compression-divider');
    expect(html).toContain('正在自动压缩背景信息');
    expect(html).toContain('已折叠 12 条消息');
    expect(html).not.toContain('Conversation Compression');
    expect(html).not.toContain('折叠消息预览');
  });

  it('renders remote skill suggestions with install details and MCP recommendation', () => {
    const message: ChatMessageRecord = {
      id: 'msg-skill-1',
      sessionId: 'session-1',
      role: 'system',
      content: '需要补充 skill',
      card: {
        type: 'skill_suggestions',
        capabilityGapDetected: true,
        status: 'suggested',
        query: 'OpenClaw 工作区设计',
        triggerReason: 'domain_specialization_needed',
        remoteSearch: {
          query: 'OpenClaw 工作区设计',
          discoverySource: 'skills.sh',
          resultCount: 1,
          executedAt: '2026-03-28T00:00:00.000Z'
        },
        mcpRecommendation: {
          kind: 'connector',
          summary: '当前更缺 GitHub MCP connector，不只是 skill。',
          reason: '当前任务涉及 GitHub 工作流，建议在 Connector & Policy Center 配置 GitHub MCP。',
          connectorTemplateId: 'github-mcp-template'
        },
        safetyNotes: ['已通过 skills.sh 远程检索 1 个候选。'],
        suggestions: [
          {
            id: 'remote:vercel-labs/skills:find-skills',
            kind: 'remote-skill',
            displayName: 'find-skills',
            summary: '先安装 find-skills，再继续远程检索。',
            score: 0.88,
            availability: 'installable-remote',
            reason: '当前问题进入专业领域，建议引入更专业的 skill 再继续回答。',
            requiredCapabilities: [],
            version: 'remote',
            sourceLabel: 'skills.sh',
            sourceTrustClass: 'curated',
            installationMode: 'marketplace-managed',
            repo: 'vercel-labs/skills',
            skillName: 'find-skills',
            detailsUrl: 'https://skills.sh/vercel-labs/skills/find-skills',
            installCommand: 'npx skills add vercel-labs/skills@find-skills -g -y',
            discoverySource: 'skills.sh',
            triggerReason: 'domain_specialization_needed',
            installState: {
              receiptId: 'receipt_find_skills',
              status: 'pending',
              result: 'waiting_for_install_approval'
            }
          }
        ]
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(renderStructuredMessageCard(message, false, {}));

    expect(html).toContain('需要更专业能力');
    expect(html).toContain('skills.sh');
    expect(html).toContain('GitHub MCP connector');
    expect(html).toContain('vercel-labs/skills');
    expect(html).toContain('npx skills add vercel-labs/skills@find-skills -g -y');
    expect(html).toContain('当前轮 Skill 介入');
    expect(html).toContain('待审批');
    expect(html).toContain('waiting_for_install_approval');
    expect(html).toContain('安装单号：receipt_find_skills');
    expect(html).toContain('等待审批');
  });

  it('renders skill reuse, worker dispatch, and runtime issue cards via extracted subcomponents', () => {
    const skillReuseMessage: ChatMessageRecord = {
      id: 'msg-skill-reuse-1',
      sessionId: 'session-1',
      role: 'system',
      content: '技能复用',
      card: {
        type: 'skill_reuse',
        reusedSkills: ['find-skills'],
        usedInstalledSkills: ['github-review'],
        usedCompanyWorkers: ['technical-architecture']
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };
    const workerDispatchMessage: ChatMessageRecord = {
      id: 'msg-worker-dispatch-1',
      sessionId: 'session-1',
      role: 'system',
      content: '派发执行',
      card: {
        type: 'worker_dispatch',
        currentMinistry: 'gongbu-code',
        currentWorker: 'worker-coder-1',
        routeReason: '当前命中代码执行路线。',
        usedInstalledSkills: ['github-review'],
        usedCompanyWorkers: ['technical-architecture'],
        connectorRefs: ['github-mcp-template'],
        chatRoute: {
          flow: 'supervisor',
          adapter: 'code',
          reason: '代码任务',
          priority: 2
        }
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };
    const runtimeIssueMessage: ChatMessageRecord = {
      id: 'msg-runtime-issue-1',
      sessionId: 'session-1',
      role: 'system',
      content: '运行时异常',
      card: {
        type: 'runtime_issue',
        severity: 'error',
        title: 'LLM provider unavailable',
        notes: ['当前已回退到兜底回复']
      },
      createdAt: '2026-03-22T00:00:00.000Z'
    };

    const skillReuseHtml = renderToStaticMarkup(renderStructuredMessageCard(skillReuseMessage, false, {}));
    const workerDispatchHtml = renderToStaticMarkup(renderStructuredMessageCard(workerDispatchMessage, false, {}));
    const runtimeIssueHtml = renderToStaticMarkup(renderStructuredMessageCard(runtimeIssueMessage, false, {}));

    expect(skillReuseHtml).toContain('Skill Reuse');
    expect(skillReuseHtml).toContain('find-skills');
    expect(workerDispatchHtml).toContain('Worker Dispatch');
    expect(workerDispatchHtml).toContain('worker-coder-1');
    expect(workerDispatchHtml).toContain('github-mcp-template');
    expect(runtimeIssueHtml).toContain('Runtime Issue');
    expect(runtimeIssueHtml).toContain('LLM provider unavailable');
  });

  it('renders inline Sources for assistant superscript citations', () => {
    const message: ChatMessageRecord = {
      id: 'msg-assistant-citation-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '这里是结论<sup>1</sup>',
      createdAt: '2026-03-22T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(
      renderStructuredMessageCard(message, false, {
        inlineEvidenceSources: [
          {
            id: 'source-1',
            sourceType: 'web',
            sourceUrl: 'https://example.com/a',
            trustClass: 'official',
            summary: 'Example 官方资料'
          }
        ]
      })
    );

    expect(html).toContain('这里是结论');
    expect(html).toContain('Example 官方资料');
  });

  it('renders skill draft cards with tool and connector contract', () => {
    const message: ChatMessageRecord = {
      id: 'msg-skill-draft-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '已创建 skill draft',
      card: {
        type: 'skill_draft_created',
        skillId: 'user-skill-1',
        displayName: 'Lark Delivery Skill',
        description: '把审批结果整理后发送到 Lark。',
        ownerType: 'user-attached',
        scope: 'workspace',
        status: 'lab',
        enabled: true,
        contract: {
          requiredTools: ['lark.send_message'],
          optionalTools: ['lark.search_docs'],
          approvalSensitiveTools: ['lark.send_message'],
          preferredConnectors: ['lark-mcp-template'],
          requiredConnectors: ['lark-mcp-template']
        },
        nextActions: ['继续在当前会话里直接调用这个 skill']
      },
      createdAt: '2026-03-29T00:00:00.000Z'
    };

    const html = renderToStaticMarkup(renderStructuredMessageCard(message, false, {}));

    expect(html).toContain('执行 Contract');
    expect(html).toContain('必需工具');
    expect(html).toContain('lark.send_message');
    expect(html).toContain('审批敏感');
    expect(html).toContain('优先连接器');
    expect(html).toContain('必需连接器');
    expect(html).toContain('lark-mcp-template');
  });
});
