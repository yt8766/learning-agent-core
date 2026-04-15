import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const childCalls = vi.hoisted(() => ({
  sourceCards: [] as any[],
  manifestCards: [] as any[],
  installedCards: [] as any[],
  receiptCards: [] as any[]
}));

vi.mock('@/features/skill-sources-center/skill-sources-source-card', () => ({
  SkillSourcesSourceCard: (props: any) => {
    childCalls.sourceCards.push(props);
    return <div>mock-source-{props.source.id}</div>;
  }
}));

vi.mock('@/features/skill-sources-center/skill-sources-manifest-card', () => ({
  SkillSourcesManifestCard: (props: any) => {
    childCalls.manifestCards.push(props);
    return <div>mock-manifest-{props.manifest.id}</div>;
  }
}));

vi.mock('@/features/skill-sources-center/skill-sources-installed-card', () => ({
  SkillSourcesInstalledCard: (props: any) => {
    childCalls.installedCards.push(props);
    return <div>mock-installed-{props.item.skillId}</div>;
  }
}));

vi.mock('@/features/skill-sources-center/skill-sources-receipt-card', () => ({
  SkillSourcesReceiptCard: (props: any) => {
    childCalls.receiptCards.push(props);
    return <div>mock-receipt-{props.item.id}</div>;
  }
}));

import { SkillSourcesCenterPanel } from '@/features/skill-sources-center/skill-sources-center-panel';

describe('SkillSourcesCenterPanel', () => {
  beforeEach(() => {
    childCalls.sourceCards.length = 0;
    childCalls.manifestCards.length = 0;
    childCalls.installedCards.length = 0;
    childCalls.receiptCards.length = 0;
  });

  it('renders sections and empty states for marketplace, manifests, installed skills and receipts', () => {
    const html = renderToStaticMarkup(
      <SkillSourcesCenterPanel
        skillSources={
          {
            summary: {},
            sources: [],
            manifests: [],
            installed: [],
            receipts: []
          } as any
        }
        onSelectTask={vi.fn()}
        onInstallSkill={vi.fn()}
        onApproveInstall={vi.fn()}
        onRejectInstall={vi.fn()}
        onEnableSource={vi.fn()}
        onDisableSource={vi.fn()}
        onSyncSource={vi.fn()}
      />
    );

    expect(html).toContain('Skill Sources');
    expect(html).toContain('Skill Sources / Marketplace');
    expect(html).toContain('Available Manifests');
    expect(html).toContain('Installed Skills');
    expect(html).toContain('Install Receipts');
    expect(html).toContain('当前还没有 skill source。');
    expect(html).toContain('当前没有可安装的 skill manifests。');
    expect(html).toContain('当前没有已安装技能。');
    expect(html).toContain('当前没有待处理的安装回执。');
  });

  it('forwards source, manifest, installed and receipt callbacks through child cards', () => {
    const onSelectTask = vi.fn();
    const onInstallSkill = vi.fn();
    const onApproveInstall = vi.fn();
    const onRejectInstall = vi.fn();
    const onEnableSource = vi.fn();
    const onDisableSource = vi.fn();
    const onSyncSource = vi.fn();

    renderToStaticMarkup(
      <SkillSourcesCenterPanel
        skillSources={
          {
            summary: {},
            sources: [{ id: 'market-1', displayName: 'Default Marketplace' }],
            manifests: [{ id: 'skill-manifest-1', displayName: 'Browser Skill', sourceId: 'market-1' }],
            installed: [{ skillId: 'browser-skill', version: '1.0.0', totalTaskCount: 2, successRate: 0.9 }],
            receipts: [{ id: 'receipt-1', status: 'pending' }]
          } as any
        }
        onSelectTask={onSelectTask}
        onInstallSkill={onInstallSkill}
        onApproveInstall={onApproveInstall}
        onRejectInstall={onRejectInstall}
        onEnableSource={onEnableSource}
        onDisableSource={onDisableSource}
        onSyncSource={onSyncSource}
      />
    );

    expect(childCalls.sourceCards).toHaveLength(1);
    expect(childCalls.manifestCards).toHaveLength(1);
    expect(childCalls.installedCards).toHaveLength(1);
    expect(childCalls.receiptCards).toHaveLength(1);

    childCalls.sourceCards[0].onEnableSource('market-1');
    childCalls.sourceCards[0].onDisableSource('market-1');
    childCalls.sourceCards[0].onSyncSource('market-1');
    childCalls.manifestCards[0].onInstallSkill('skill-manifest-1', 'market-1');
    childCalls.installedCards[0].onSelectTask('task-1');
    childCalls.receiptCards[0].onApproveInstall('receipt-1');
    childCalls.receiptCards[0].onRejectInstall('receipt-1');

    expect(onEnableSource).toHaveBeenCalledWith('market-1');
    expect(onDisableSource).toHaveBeenCalledWith('market-1');
    expect(onSyncSource).toHaveBeenCalledWith('market-1');
    expect(onInstallSkill).toHaveBeenCalledWith('skill-manifest-1', 'market-1');
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
    expect(onApproveInstall).toHaveBeenCalledWith('receipt-1');
    expect(onRejectInstall).toHaveBeenCalledWith('receipt-1');
  });
});
