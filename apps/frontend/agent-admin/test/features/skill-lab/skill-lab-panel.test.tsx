import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedButtons: Array<{ children?: React.ReactNode; onClick?: () => void; disabled?: boolean }> = [];

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => {
    renderedButtons.push({ children, onClick, disabled });
    return <button>{children}</button>;
  }
}));

import { SkillLabPanel } from '@/features/skill-lab/skill-lab-panel';

describe('SkillLabPanel', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
  });

  it('renders skill and rule governance cards', () => {
    const html = renderToStaticMarkup(
      <SkillLabPanel
        skills={[
          {
            id: 'skill-1',
            name: 'Evidence Summarizer',
            description: '用于压缩来源卡片',
            status: 'stable',
            version: '1.2.0',
            successRate: 0.92
          }
        ]}
        rules={[
          {
            id: 'rule-1',
            name: 'No direct publish',
            summary: '发布能力必须审批',
            action: 'require approval',
            status: 'active'
          }
        ]}
        loading={false}
        onPromote={vi.fn()}
        onDisable={vi.fn()}
        onRestoreSkill={vi.fn()}
        onRetireSkill={vi.fn()}
        onInvalidateRule={vi.fn()}
        onSupersedeRule={vi.fn()}
        onRestoreRule={vi.fn()}
        onRetireRule={vi.fn()}
      />
    );

    expect(html).toContain('Skill Lab');
    expect(html).toContain('Rules Governance');
    expect(html).toContain('Evidence Summarizer');
    expect(html).toContain('成功率 92%');
    expect(html).toContain('No direct publish');
  });

  it('routes skill and rule actions through callbacks and reflects disabled states', () => {
    const onPromote = vi.fn();
    const onDisable = vi.fn();
    const onRestoreSkill = vi.fn();
    const onRetireSkill = vi.fn();
    const onInvalidateRule = vi.fn();
    const onSupersedeRule = vi.fn();
    const onRestoreRule = vi.fn();
    const onRetireRule = vi.fn();

    renderToStaticMarkup(
      <SkillLabPanel
        skills={[
          {
            id: 'skill-stable',
            name: 'Stable Skill',
            description: 'stable',
            status: 'stable'
          },
          {
            id: 'skill-disabled',
            name: 'Disabled Skill',
            description: 'disabled',
            status: 'disabled'
          }
        ]}
        rules={[
          {
            id: 'rule-active',
            name: 'Active Rule',
            summary: 'active summary',
            action: 'allow',
            status: 'active'
          },
          {
            id: 'rule-invalidated',
            name: 'Invalid Rule',
            summary: 'invalid summary',
            action: 'deny',
            status: 'invalidated',
            invalidationReason: 'expired',
            supersededById: 'rule-next'
          }
        ]}
        loading={false}
        onPromote={onPromote}
        onDisable={onDisable}
        onRestoreSkill={onRestoreSkill}
        onRetireSkill={onRetireSkill}
        onInvalidateRule={onInvalidateRule}
        onSupersedeRule={onSupersedeRule}
        onRestoreRule={onRestoreRule}
        onRetireRule={onRetireRule}
      />
    );

    renderedButtons.find(item => item.children === '晋升' && item.disabled !== true)?.onClick?.();
    renderedButtons.find(item => item.children === '禁用' && item.disabled !== true)?.onClick?.();
    renderedButtons.find(item => item.children === '恢复' && item.disabled !== true)?.onClick?.();
    renderedButtons.filter(item => item.children === '归档')[0]?.onClick?.();
    renderedButtons.find(item => item.children === '失效' && item.disabled !== true)?.onClick?.();
    renderedButtons.find(item => item.children === '替代')?.onClick?.();
    renderedButtons.filter(item => item.children === '恢复')[3]?.onClick?.();
    renderedButtons.filter(item => item.children === '归档')[2]?.onClick?.();

    expect(onPromote).toHaveBeenCalledWith('skill-disabled');
    expect(onDisable).toHaveBeenCalledWith('skill-stable');
    expect(onRestoreSkill).toHaveBeenCalledWith('skill-disabled');
    expect(onRetireSkill).toHaveBeenCalledWith('skill-stable');
    expect(onInvalidateRule).toHaveBeenCalledWith('rule-active');
    expect(onSupersedeRule).toHaveBeenCalledWith('rule-active');
    expect(onRestoreRule).toHaveBeenCalledWith('rule-invalidated');
    expect(onRetireRule).toHaveBeenCalledWith('rule-active');
    expect(renderedButtons.find(item => item.children === '晋升' && item.disabled === true)).toBeTruthy();
    expect(renderedButtons.find(item => item.children === '禁用' && item.disabled === true)).toBeTruthy();
    expect(renderedButtons.find(item => item.children === '失效' && item.disabled === true)).toBeTruthy();
  });

  it('renders skill and rule empty states', () => {
    const html = renderToStaticMarkup(
      <SkillLabPanel
        skills={[]}
        rules={[]}
        loading={false}
        onPromote={vi.fn()}
        onDisable={vi.fn()}
        onRestoreSkill={vi.fn()}
        onRetireSkill={vi.fn()}
        onInvalidateRule={vi.fn()}
        onSupersedeRule={vi.fn()}
        onRestoreRule={vi.fn()}
        onRetireRule={vi.fn()}
      />
    );

    expect(html).toContain('当前没有技能记录。');
    expect(html).toContain('当前没有规则记录。');
  });
});
