import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RulesPanel } from '@/pages/rules-browser/rules-panel';

describe('RulesPanel', () => {
  it('renders rule cards with unified card styling', () => {
    const html = renderToStaticMarkup(
      <RulesPanel
        rules={[
          {
            id: 'rule-1',
            name: '审批门',
            summary: '高风险工具必须审批',
            action: 'approval-required',
            status: 'active'
          }
        ]}
      />
    );

    expect(html).toContain('规则沉淀');
    expect(html).toContain('审批门');
    expect(html).toContain('border-border/70');
  });
});
