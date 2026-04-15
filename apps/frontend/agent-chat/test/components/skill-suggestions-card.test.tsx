import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SkillSuggestionsCard } from '@/components/chat-message-cards/skill-suggestions-card';

describe('SkillSuggestionsCard', () => {
  it('renders active install, safety, remote search, and install action states', () => {
    const html = renderToStaticMarkup(
      <SkillSuggestionsCard
        card={
          {
            type: 'skill_suggestions',
            status: 'ready',
            capabilityGapDetected: true,
            triggerReason: 'domain_specialization_needed',
            safetyNotes: ['来源可信', '需要审批'],
            remoteSearch: {
              discoverySource: 'skills.sh',
              query: 'github mcp',
              resultCount: 2
            },
            mcpRecommendation: {
              summary: '推荐接入 GitHub MCP',
              reason: '便于代码与 PR 流程复用'
            },
            suggestions: [
              {
                id: 'skill-1',
                kind: 'skill',
                displayName: 'GitHub Review Skill',
                availability: 'installable-remote',
                summary: '用于 GitHub 审查',
                reason: '当前任务涉及 PR 评论',
                repo: 'openai/skill-github',
                detailsUrl: 'https://example.com/skill-1',
                installCommand: 'codex skill add github-review',
                requiredCapabilities: ['repo-read'],
                requiredConnectors: ['github'],
                sourceLabel: 'remote',
                governanceRecommendation: 'approval-required',
                successRate: 0.92,
                version: '1.2.0',
                safety: {
                  verdict: 'needs-approval',
                  trustScore: 78,
                  reasons: ['需要 connector 权限']
                },
                installState: {
                  status: 'pending',
                  receiptId: 'receipt-1'
                }
              }
            ]
          } as any
        }
      />
    );

    expect(html).toContain('Capability Gap');
    expect(html).toContain('需要更专业能力');
    expect(html).toContain('skills.sh');
    expect(html).toContain('当前轮 Skill 介入');
    expect(html).toContain('待审批');
    expect(html).toContain('等待你批准安装后继续执行');
    expect(html).toContain('推荐接入 GitHub MCP');
    expect(html).toContain('来源可信；需要审批');
    expect(html).toContain('trust 78');
    expect(html).toContain('success 92%');
    expect(html).toContain('安装单号：receipt-1');
    expect(html).toContain('等待审批');
  });

  it('renders fallback trigger labels and reinstall states', () => {
    const html = renderToStaticMarkup(
      <SkillSuggestionsCard
        card={
          {
            type: 'skill_suggestions',
            status: 'ready',
            capabilityGapDetected: false,
            triggerReason: 'capability_gap_detected',
            safetyNotes: [],
            suggestions: [
              {
                id: 'skill-2',
                kind: 'skill',
                displayName: 'Local Refactor Skill',
                availability: 'installable-local',
                summary: '本地重构建议',
                reason: '缺少重构模板',
                requiredCapabilities: [],
                installState: {
                  status: 'failed',
                  result: 'network timeout',
                  failureCode: 'network_timeout'
                }
              },
              {
                id: 'skill-3',
                kind: 'skill',
                displayName: 'Ready Skill',
                availability: 'ready',
                summary: '直接可用',
                reason: '已安装',
                requiredCapabilities: []
              }
            ]
          } as any
        }
      />
    );

    expect(html).toContain('Local Skills');
    expect(html).toContain('检测到能力缺口');
    expect(html).toContain('重新安装');
    expect(html).toContain('状态：network timeout');
    expect(html).toContain('失败原因：network_timeout');
    expect(html).toContain('Ready Skill');
  });
});
