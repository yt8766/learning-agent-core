import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeOverviewChart } from '../src/pages/overview/knowledge-overview-chart';

const chartProps = vi.hoisted(() => ({
  latest: undefined as { option?: { tooltip?: { confine?: boolean } }; style?: React.CSSProperties } | undefined
}));

vi.mock('echarts-for-react', () => ({
  default(props: { option?: { tooltip?: { confine?: boolean } }; style?: React.CSSProperties }) {
    chartProps.latest = props;
    return <div data-chart="overview" />;
  }
}));

describe('KnowledgeOverviewChart boundaries', () => {
  it('confines tooltips and renders charts at container width', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart
        color="#1677ff"
        data={[{ label: '周一', value: 86 }]}
        name="命中率"
        type="line"
        unit="%"
      />
    );

    expect(chartProps.latest?.option?.tooltip?.confine).toBe(true);
    expect(chartProps.latest?.style).toMatchObject({ height: 220, width: '100%' });
  });

  it('keeps overview chart cards from expanding outside their column', () => {
    const css = readFileSync(resolve(__dirname, '../src/styles/knowledge-pro.css'), 'utf8');

    expect(css).toContain('.knowledge-overview-chart-stack .ant-space-item');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('overflow: hidden');
  });
});
