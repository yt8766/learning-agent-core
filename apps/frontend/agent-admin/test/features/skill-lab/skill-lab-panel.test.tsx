import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SkillLabPanel } from '@/features/skill-lab/skill-lab-panel';

describe('SkillLabPanel', () => {
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
    expect(html).toContain('No direct publish');
  });
});
