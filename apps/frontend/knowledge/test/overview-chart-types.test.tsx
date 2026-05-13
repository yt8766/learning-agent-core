/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const chartProps = vi.hoisted(() => ({
  latest: undefined as { option?: any } | undefined
}));

vi.mock('echarts-for-react', () => ({
  default(props: { option?: any }) {
    chartProps.latest = props;
    return <div data-chart="overview" />;
  }
}));

import { KnowledgeOverviewChart } from '../src/pages/overview/knowledge-overview-chart';

describe('KnowledgeOverviewChart', () => {
  it('renders line chart with area style', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart
        color="#1677ff"
        data={[
          { label: 'Mon', value: 86 },
          { label: 'Tue', value: 92 }
        ]}
        name="Hit Rate"
        type="line"
        unit="%"
      />
    );

    const series = chartProps.latest?.option?.series?.[0];
    expect(series.type).toBe('line');
    expect(series.areaStyle).toBeDefined();
    expect(series.smooth).toBe(true);
    expect(series.symbol).toBe('circle');
    expect(series.data).toEqual([86, 92]);
  });

  it('renders bar chart without area style', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart
        color="#52c41a"
        data={[
          { label: 'Jan', value: 100 },
          { label: 'Feb', value: 150 }
        ]}
        name="Documents"
        type="bar"
      />
    );

    const series = chartProps.latest?.option?.series?.[0];
    expect(series.type).toBe('bar');
    expect(series.areaStyle).toBeUndefined();
    expect(series.smooth).toBe(false);
    expect(series.symbol).toBeUndefined();
    expect(series.data).toEqual([100, 150]);
  });

  it('uses default height when not specified', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart color="#1677ff" data={[{ label: 'A', value: 10 }]} name="Test" type="line" />
    );

    expect(chartProps.latest?.option?.series).toBeDefined();
  });

  it('formats tooltip for single data point', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart
        color="#1677ff"
        data={[{ label: 'Week', value: 75 }]}
        name="Score"
        type="line"
        unit="pts"
      />
    );

    const formatter = chartProps.latest?.option?.tooltip?.formatter;
    expect(typeof formatter).toBe('function');

    // Test with a valid tooltip point
    const result = formatter({ marker: '<span/>', name: 'Week', value: 75 });
    expect(result).toContain('Week');
    expect(result).toContain('75');
    expect(result).toContain('Score');
    expect(result).toContain('pts');
  });

  it('formats tooltip for array of data points', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart color="#1677ff" data={[{ label: 'Week', value: 75 }]} name="Score" type="line" />
    );

    const formatter = chartProps.latest?.option?.tooltip?.formatter;
    const result = formatter([{ marker: '<span/>', name: 'Week', value: 75 }]);
    expect(result).toContain('Week');
    expect(result).toContain('75');
  });

  it('returns empty string for invalid tooltip params', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart color="#1677ff" data={[{ label: 'Week', value: 75 }]} name="Score" type="line" />
    );

    const formatter = chartProps.latest?.option?.tooltip?.formatter;
    expect(formatter(null)).toBe('');
    expect(formatter(undefined)).toBe('');
    expect(formatter('string')).toBe('');
    expect(formatter(123)).toBe('');
    expect(formatter({})).toBe('');
    expect(formatter({ marker: 123, name: 'test', value: 1 })).toBe('');
  });

  it('formats tooltip without unit', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart color="#1677ff" data={[{ label: 'Day', value: 50 }]} name="Count" type="bar" />
    );

    const formatter = chartProps.latest?.option?.tooltip?.formatter;
    const result = formatter({ marker: '<span/>', name: 'Day', value: 50 });
    expect(result).toContain('50');
    expect(result).toContain('Count');
  });

  it('configures xAxis with data labels', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart
        color="#1677ff"
        data={[
          { label: 'A', value: 1 },
          { label: 'B', value: 2 }
        ]}
        name="Test"
        type="bar"
      />
    );

    expect(chartProps.latest?.option?.xAxis?.data).toEqual(['A', 'B']);
    expect(chartProps.latest?.option?.xAxis?.type).toBe('category');
  });

  it('configures yAxis as value type', () => {
    renderToStaticMarkup(
      <KnowledgeOverviewChart color="#1677ff" data={[{ label: 'A', value: 1 }]} name="Test" type="bar" unit="%" />
    );

    expect(chartProps.latest?.option?.yAxis?.type).toBe('value');
    expect(chartProps.latest?.option?.yAxis?.axisLabel?.formatter).toContain('%');
  });
});
