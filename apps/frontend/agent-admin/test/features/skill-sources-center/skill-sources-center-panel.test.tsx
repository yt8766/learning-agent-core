import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SkillSourcesCenterPanel } from '@/features/skill-sources-center/skill-sources-center-panel';

describe('SkillSourcesCenterPanel render smoke', () => {
  it('renders sections for marketplace and installed skills', () => {
    const html = renderToStaticMarkup(
      <SkillSourcesCenterPanel
        skillSources={
          {
            summary: {},
            sources: [{ id: 'market-1', displayName: 'Default Marketplace' }],
            manifests: [{ id: 'skill-manifest-1', displayName: 'Browser Skill' }],
            installed: [{ skillId: 'browser-skill', version: '1.0.0' }],
            receipts: [{ id: 'receipt-1', status: 'pending' }]
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
  });
});
