import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedButtons: Array<{ children?: React.ReactNode; onClick?: () => void }> = [];

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children}</button>;
  }
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>
}));

import { SkillSourcesInstalledCard } from '@/pages/skill-sources-center/skill-sources-installed-card';
import { SkillSourcesManifestCard } from '@/pages/skill-sources-center/skill-sources-manifest-card';
import { SkillSourcesReceiptCard } from '@/pages/skill-sources-center/skill-sources-receipt-card';
import { SkillSourcesSourceCard } from '@/pages/skill-sources-center/skill-sources-source-card';

describe('Skill source cards', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
  });

  it('renders source metadata and routes enable, disable and sync actions', () => {
    const onEnableSource = vi.fn();
    const onDisableSource = vi.fn();
    const onSyncSource = vi.fn();

    const enabledHtml = renderToStaticMarkup(
      <SkillSourcesSourceCard
        source={
          {
            id: 'source-1',
            name: 'Curated Marketplace',
            baseUrl: 'https://skills.example.com',
            enabled: true,
            healthState: 'healthy',
            kind: 'remote-index',
            discoveryMode: 'remote',
            priority: 'high',
            trustClass: 'curated',
            syncStrategy: 'hourly',
            authMode: 'token',
            healthReason: 'index reachable',
            indexUrl: 'https://skills.example.com/index.json',
            packageBaseUrl: 'https://packages.example.com',
            lastSyncedAt: '2026-04-10T09:00:00.000Z',
            profilePolicy: {
              enabledByProfile: true,
              reason: 'platform profile allowed'
            }
          } as any
        }
        onEnableSource={onEnableSource}
        onDisableSource={onDisableSource}
        onSyncSource={onSyncSource}
      />
    );

    renderedButtons.find(item => item.children === '停用来源')?.onClick?.();
    renderedButtons.find(item => item.children === 'Sync Now')?.onClick?.();

    expect(enabledHtml).toContain('Curated Marketplace');
    expect(enabledHtml).toContain('https://skills.example.com');
    expect(enabledHtml).toContain('profile allowed');
    expect(enabledHtml).toContain('index: https://skills.example.com/index.json');
    expect(enabledHtml).toContain('package: https://packages.example.com');
    expect(enabledHtml).toContain('last synced 2026-04-10T09:00:00.000Z');
    expect(enabledHtml).toContain('profile policy: platform profile allowed');
    expect(onDisableSource).toHaveBeenCalledWith('source-1');
    expect(onSyncSource).toHaveBeenCalledWith('source-1');
    expect(onEnableSource).not.toHaveBeenCalled();

    renderedButtons.length = 0;

    renderToStaticMarkup(
      <SkillSourcesSourceCard
        source={
          {
            id: 'source-2',
            name: 'Local Skills',
            baseUrl: '/tmp/skills',
            enabled: false,
            healthState: 'offline',
            kind: 'local-dir',
            discoveryMode: 'local-dir',
            priority: 'normal',
            trustClass: 'workspace'
          } as any
        }
        onEnableSource={onEnableSource}
        onDisableSource={onDisableSource}
        onSyncSource={onSyncSource}
      />
    );

    renderedButtons.find(item => item.children === '启用来源')?.onClick?.();

    expect(onEnableSource).toHaveBeenCalledWith('source-2');
    expect(renderedButtons.find(item => item.children === 'Sync Now')).toBeUndefined();
  });

  it('renders manifest metadata and routes install action with source context', () => {
    const onInstallSkill = vi.fn();

    const html = renderToStaticMarkup(
      <SkillSourcesManifestCard
        manifest={
          {
            id: 'manifest-1',
            sourceId: 'source-1',
            name: 'Browser Replay Skill',
            version: '1.2.3',
            description: 'Replays browser evidence into traceable task steps.',
            riskLevel: 'moderate',
            publisher: 'OpenClaw',
            approvalPolicy: 'manual',
            license: 'MIT',
            publishedAt: '2026-04-09',
            summary: 'Adds browser replay support.',
            entry: 'dist/index.js',
            artifactUrl: 'https://skills.example.com/browser.tgz',
            homepageUrl: 'https://skills.example.com/browser',
            compatibility: 'requires runtime >= 0.3',
            sizeBytes: 2048,
            requiredConnectors: ['browser-mcp'],
            allowedTools: ['browse_page'],
            safety: {
              verdict: 'review',
              trustScore: 82,
              reasons: ['需要人工审查外部来源']
            }
          } as any
        }
        onInstallSkill={onInstallSkill}
      />
    );

    renderedButtons.find(item => item.children === '安装到技能工坊')?.onClick?.();

    expect(html).toContain('Browser Replay Skill');
    expect(html).toContain('v1.2.3');
    expect(html).toContain('OpenClaw');
    expect(html).toContain('manual');
    expect(html).toContain('MIT');
    expect(html).toContain('2026-04-09');
    expect(html).toContain('review');
    expect(html).toContain('trust 82');
    expect(html).toContain('browser-mcp');
    expect(html).toContain('browse_page');
    expect(html).toContain('artifact: https://skills.example.com/browser.tgz');
    expect(html).toContain('homepage: https://skills.example.com/browser');
    expect(html).toContain('requires runtime &gt;= 0.3');
    expect(html).toContain('size 2048 bytes');
    expect(html).toContain('需要人工审查外部来源');
    expect(onInstallSkill).toHaveBeenCalledWith('manifest-1', 'source-1');
  });

  it('renders installed skill drill-down details and routes select-task action', () => {
    const onSelectTask = vi.fn();

    const html = renderToStaticMarkup(
      <SkillSourcesInstalledCard
        item={
          {
            skillId: 'browser-replay',
            installLocation: '/tmp/skills/browser-replay',
            status: 'installed',
            version: '1.2.3',
            sourceId: 'source-1',
            successRate: 0.92,
            governanceRecommendation: 'promote',
            activeTaskCount: 1,
            totalTaskCount: 4,
            recentTaskGoals: ['回放浏览器轨迹'],
            recentTasks: [
              {
                taskId: 'task-123',
                goal: '回放浏览器轨迹',
                status: 'completed',
                approvalCount: 1,
                latestTraceSummary: 'evidence captured'
              }
            ],
            firstUsedAt: '2026-04-08T10:00:00.000Z',
            lastUsedAt: '2026-04-10T10:00:00.000Z',
            lastOutcome: 'success',
            recentFailureReason: 'timeout once',
            compatibility: 'browser worker only',
            allowedTools: ['browse_page']
          } as any
        }
        onSelectTask={onSelectTask}
      />
    );

    renderedButtons.find(item => item.children === '查看任务')?.onClick?.();

    expect(html).toContain('browser-replay');
    expect(html).toContain('/tmp/skills/browser-replay');
    expect(html).toContain('success 92%');
    expect(html).toContain('suggest promote');
    expect(html).toContain('active 1');
    expect(html).toContain('used 4');
    expect(html).toContain('Recent Goals');
    expect(html).toContain('Task Drill-down');
    expect(html).toContain('task-123 · completed · approvals 1');
    expect(html).toContain('evidence captured');
    expect(html).toContain('first used 2026-04-08T10:00:00.000Z');
    expect(html).toContain('last used 2026-04-10T10:00:00.000Z');
    expect(html).toContain('last outcome success');
    expect(html).toContain('recent failure: timeout once');
    expect(html).toContain('browser worker only');
    expect(html).toContain('browse_page');
    expect(onSelectTask).toHaveBeenCalledWith('task-123');
  });

  it('renders pending receipt actions and hides them for settled receipts', () => {
    const onApproveInstall = vi.fn();
    const onRejectInstall = vi.fn();

    const pendingHtml = renderToStaticMarkup(
      <SkillSourcesReceiptCard
        item={
          {
            id: 'receipt-1',
            skillId: 'browser-replay',
            result: 'awaiting approval',
            status: 'pending',
            phase: 'downloaded',
            downloadRef: 's3://receipts/browser-replay',
            failureCode: 'approval_required',
            failureDetail: '需要平台管理员批准'
          } as any
        }
        onApproveInstall={onApproveInstall}
        onRejectInstall={onRejectInstall}
      />
    );

    renderedButtons.find(item => item.children === '批准安装')?.onClick?.();
    renderedButtons.find(item => item.children === '拒绝安装')?.onClick?.();

    expect(pendingHtml).toContain('browser-replay');
    expect(pendingHtml).toContain('awaiting approval');
    expect(pendingHtml).toContain('phase: downloaded');
    expect(pendingHtml).toContain('download: s3://receipts/browser-replay');
    expect(pendingHtml).toContain('failure: approval_required');
    expect(pendingHtml).toContain('需要平台管理员批准');
    expect(onApproveInstall).toHaveBeenCalledWith('receipt-1');
    expect(onRejectInstall).toHaveBeenCalledWith('receipt-1');

    renderedButtons.length = 0;

    const settledHtml = renderToStaticMarkup(
      <SkillSourcesReceiptCard
        item={
          {
            id: 'receipt-2',
            skillId: 'browser-replay',
            status: 'installed'
          } as any
        }
        onApproveInstall={onApproveInstall}
        onRejectInstall={onRejectInstall}
      />
    );

    expect(settledHtml).toContain('pending result');
    expect(renderedButtons.find(item => item.children === '批准安装')).toBeUndefined();
    expect(renderedButtons.find(item => item.children === '拒绝安装')).toBeUndefined();
  });
});
