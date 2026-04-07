import { describe, expect, it } from 'vitest';

import { renderSummaryDigest } from '../../../src/runtime/briefings/runtime-tech-briefing-localize';

describe('renderSummaryDigest', () => {
  it('会静默空分类并在底部追加巡检说明', () => {
    const digest = renderSummaryDigest({
      now: new Date('2026-04-03T02:38:01.485Z'),
      sendEmptyDigest: true,
      renderMode: 'dual',
      detailMode: 'detailed',
      sourceGroups: {
        official: ['Node.js Security'],
        authority: [],
        community: []
      },
      lookbackDaysByCategory: {
        'frontend-security': 7,
        'general-security': 7,
        'devtool-security': 7,
        'ai-tech': 7,
        'frontend-tech': 7,
        'backend-tech': 7,
        'cloud-infra-tech': 7
      },
      categories: [
        {
          category: 'frontend-security',
          title: '前端安全情报 | 2026-04-03',
          status: 'empty',
          itemCount: 0,
          sent: true,
          emptyDigest: true,
          sourcesChecked: [],
          displayedItems: [],
          newCount: 0,
          updateCount: 0,
          crossRunSuppressedCount: 1,
          sameRunMergedCount: 0,
          overflowCollapsedCount: 0
        },
        {
          category: 'general-security',
          title: '通用安全情报 | 2026-04-03',
          status: 'sent',
          itemCount: 1,
          sent: true,
          emptyDigest: false,
          sourcesChecked: [],
          newCount: 1,
          updateCount: 0,
          crossRunSuppressedCount: 0,
          sameRunMergedCount: 0,
          overflowCollapsedCount: 0,
          displayedItems: [
            {
              id: 'node-security',
              category: 'general-security',
              title: 'Node.js Security Releases',
              cleanTitle: 'Node.js Security Releases',
              url: 'https://nodejs.org/security',
              publishedAt: '2026-04-01T00:00:00.000Z',
              sourceName: 'Node.js Security',
              sourceUrl: 'https://nodejs.org',
              sourceType: 'official-page',
              authorityTier: 'official-advisory',
              sourceGroup: 'official',
              contentKind: 'advisory',
              summary: 'Node.js 发布了新的安全修复说明。',
              confidence: 0.95,
              sourceLabel: 'Node.js Security',
              relevanceReason: '命中基础设施与通用安全高风险关键词',
              technicalityScore: 5,
              crossVerified: false,
              priorityCode: 'P1',
              actionDeadline: '本周内',
              displayScope: 'node.js (中度相关)',
              actionSteps: {
                triage: ['确认现网 Node.js 版本与基础镜像'],
                fix: ['升级到官方修复版本'],
                verify: ['验证服务启动与核心链路']
              }
            }
          ]
        }
      ]
    });

    expect(digest.content).toContain('## 🔐 通用安全情报');
    expect(digest.content).not.toContain('## 🚨 前端安全情报');
    expect(digest.content).toContain('已巡检前端安全情报');
    const serializedCard = JSON.stringify(digest.card);
    expect(serializedCard).not.toContain('**🚨 前端安全情报**');
    expect(serializedCard).toContain('已巡检前端安全情报等 1 个分类');
    expect(serializedCard).toContain('今日无新增高置信更新');
  });

  it('单分类即使被静默也使用分类标题而不是总标题', () => {
    const digest = renderSummaryDigest({
      now: new Date('2026-04-03T02:38:01.485Z'),
      sendEmptyDigest: true,
      renderMode: 'dual',
      detailMode: 'detailed',
      sourceGroups: {
        official: ['OpenAI News'],
        authority: [],
        community: []
      },
      lookbackDaysByCategory: {
        'frontend-security': 7,
        'general-security': 7,
        'devtool-security': 7,
        'ai-tech': 7,
        'frontend-tech': 7,
        'backend-tech': 7,
        'cloud-infra-tech': 7
      },
      categories: [
        {
          category: 'devtool-security',
          title: 'Agent / DevTool 安全情报 | 2026-04-03',
          status: 'empty',
          itemCount: 0,
          sent: true,
          emptyDigest: true,
          sourcesChecked: [],
          displayedItems: [],
          newCount: 0,
          updateCount: 0,
          crossRunSuppressedCount: 1,
          sameRunMergedCount: 0,
          overflowCollapsedCount: 0
        }
      ]
    });

    expect(digest.title).toBe('🛡️ Agent / DevTool 安全情报');
    expect(digest.content).not.toContain('每日技术情报简报');
  });

  it('AI 新技术情报使用与前端技术一致的详细卡片结构', () => {
    const digest = renderSummaryDigest({
      now: new Date('2026-04-03T02:38:01.485Z'),
      sendEmptyDigest: true,
      renderMode: 'dual',
      detailMode: 'detailed',
      sourceGroups: {
        official: ['OpenAI News'],
        authority: [],
        community: []
      },
      lookbackDaysByCategory: {
        'frontend-security': 7,
        'general-security': 7,
        'devtool-security': 7,
        'ai-tech': 7,
        'frontend-tech': 7,
        'backend-tech': 7,
        'cloud-infra-tech': 7
      },
      categories: [
        {
          category: 'ai-tech',
          title: 'AI 新技术情报 | 2026-04-03',
          status: 'sent',
          itemCount: 1,
          sent: true,
          emptyDigest: false,
          sourcesChecked: [],
          newCount: 1,
          updateCount: 0,
          crossRunSuppressedCount: 0,
          sameRunMergedCount: 0,
          overflowCollapsedCount: 0,
          displayedItems: [
            {
              id: 'openai-news',
              category: 'ai-tech',
              title: 'OpenAI ships a new realtime API update',
              cleanTitle: 'OpenAI ships a new realtime API update',
              url: 'https://openai.com/news/new-realtime-api-update',
              publishedAt: '2026-04-01T00:00:00.000Z',
              sourceName: 'OpenAI News',
              sourceUrl: 'https://openai.com/news/',
              sourceType: 'rss',
              authorityTier: 'official-blog',
              sourceGroup: 'official',
              contentKind: 'release',
              summary: 'Latest API release for realtime agents and multimodal orchestration.',
              confidence: 0.95,
              sourceLabel: 'OpenAI News',
              relevanceReason: '命中 AI 模型与平台更新',
              technicalityScore: 5,
              crossVerified: false,
              priorityCode: 'P2',
              actionDeadline: '下个迭代',
              displayScope: 'AI 平台与接口',
              actionSteps: {
                triage: ['确认是否涉及现有模型接入与 SDK 版本'],
                fix: ['评估升级路径与兼容性影响'],
                verify: ['验证关键调用链路与回归场景']
              }
            }
          ]
        }
      ]
    });

    const serializedCard = JSON.stringify(digest.card);
    expect(serializedCard).toContain('AI 新技术情报');
    expect(serializedCard).toContain('核心模型演进与发布');
    expect(serializedCard).toContain('查看原文');
    expect(serializedCard).toContain('"tag":"action"');
    expect(serializedCard).toContain('命中范围');
    expect(serializedCard).toContain('关键影响');
    expect(serializedCard).toContain('建议动作');
  });

  it('检查命令按说明加单命令块渲染，而不是整坨 bash', () => {
    const digest = renderSummaryDigest({
      now: new Date('2026-04-03T02:38:01.485Z'),
      sendEmptyDigest: true,
      renderMode: 'dual',
      detailMode: 'detailed',
      sourceGroups: {
        official: ['Anthropic Security'],
        authority: [],
        community: []
      },
      lookbackDaysByCategory: {
        'frontend-security': 7,
        'general-security': 7,
        'devtool-security': 7,
        'ai-tech': 7,
        'frontend-tech': 7,
        'backend-tech': 7,
        'cloud-infra-tech': 7
      },
      categories: [
        {
          category: 'devtool-security',
          title: 'Agent / DevTool 安全情报 | 2026-04-03',
          status: 'sent',
          itemCount: 1,
          sent: true,
          emptyDigest: false,
          sourcesChecked: [],
          newCount: 1,
          updateCount: 0,
          crossRunSuppressedCount: 0,
          sameRunMergedCount: 0,
          overflowCollapsedCount: 0,
          displayedItems: [
            {
              id: 'claude-code-risk',
              category: 'devtool-security',
              title: 'Claude Code workspace trust issue may expose local config',
              cleanTitle: 'Claude Code workspace trust issue may expose local config',
              url: 'https://example.com/claude-code-risk',
              publishedAt: '2026-04-01T00:00:00.000Z',
              sourceName: 'Anthropic Security',
              sourceUrl: 'https://example.com',
              sourceType: 'official-page',
              authorityTier: 'official-advisory',
              sourceGroup: 'official',
              contentKind: 'advisory',
              summary: 'A local trust configuration issue may expose config and MCP-related settings.',
              confidence: 0.95,
              sourceLabel: 'Anthropic Security',
              relevanceReason: '命中 Claude Code 与 workspace trust 风险',
              technicalityScore: 5,
              crossVerified: false,
              priorityCode: 'P1',
              actionDeadline: '本周内',
              displayScope: 'claude code / workspace trust',
              actionSteps: {
                triage: ['确认团队是否安装受影响版本'],
                fix: ['升级到修复版本'],
                verify: ['验证日志、缓存与配置未泄露']
              }
            }
          ]
        }
      ]
    });

    expect(digest.content).toContain('检查本机 Claude Code 版本：');
    expect(digest.content).toContain('搜索本地配置与当前目录里是否出现相关配置项：');
    expect(digest.content).toContain('```bash\nclaude --version\n```');
    expect(digest.content).toContain('```bash\nrg -n "claude|workspace trust|mcp" ~/.config .\n```');
    const serializedCard = JSON.stringify(digest.card);
    expect(serializedCard).toContain('检查本机 Claude Code 版本：');
    expect(serializedCard).toContain('搜索本地配置与当前目录里是否出现相关配置项：');
  });
});
