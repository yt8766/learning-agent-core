import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => ({
  Legend: ({ children }: { children?: React.ReactNode }) => <div data-slot="legend">{children}</div>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div data-slot="tooltip">{children}</div>,
  ResponsiveContainer: ({
    width,
    height,
    children
  }: {
    width?: string | number;
    height?: string | number;
    children?: React.ReactNode;
  }) => (
    <div data-height={String(height)} data-slot="responsive-container" data-width={String(width)}>
      {children}
    </div>
  )
}));

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

describe('chart ui helpers', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (typeof originalWindow === 'undefined') {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      globalThis.window = originalWindow;
    }
  });

  it('renders chart container with css variables on the server', () => {
    Reflect.deleteProperty(globalThis, 'window');

    const html = renderToStaticMarkup(
      <ChartContainer
        config={{
          visits: { label: 'Visits', color: '#112233' },
          errors: { label: 'Errors' }
        }}
        className="extra-class"
      >
        <div>chart-body</div>
      </ChartContainer>
    );

    expect(html).toContain('data-slot="chart"');
    expect(html).toContain('--color-visits:#112233');
    expect(html).toContain('--color-errors:var(--chart-2)');
    expect(html).toContain('extra-class');
    expect(html).toContain('chart-body');
    expect(html).not.toContain('responsive-container');
  });

  it('wraps children in responsive container when window is available', () => {
    globalThis.window = {} as Window & typeof globalThis;

    const html = renderToStaticMarkup(
      <ChartContainer
        config={{
          revenue: { label: 'Revenue' }
        }}
      >
        <div>client-chart</div>
      </ChartContainer>
    );

    expect(html).toContain('data-slot="responsive-container"');
    expect(html).toContain('data-width="100%"');
    expect(html).toContain('data-height="100%"');
    expect(html).toContain('client-chart');
  });

  it('re-exports recharts tooltip and legend components', () => {
    expect(renderToStaticMarkup(<ChartTooltip />)).toContain('data-slot="tooltip"');
    expect(renderToStaticMarkup(<ChartLegend />)).toContain('data-slot="legend"');
  });

  it('renders tooltip content with label and formatter fallbacks', () => {
    const html = renderToStaticMarkup(
      <ChartContainer
        config={{
          visits: { label: 'Visits', color: '#445566' },
          errors: { label: 'Errors' }
        }}
      >
        <ChartTooltipContent
          active
          label="Today"
          className="tooltip-extra"
          labelFormatter={value => `Label:${value}`}
          formatter={(value, name) => `${name}:${value}`}
          payload={[
            { dataKey: 'visits', value: 42 },
            { name: 'errors', value: 3, color: '#aa0000' }
          ]}
        />
      </ChartContainer>
    );

    expect(html).toContain('Label:Today');
    expect(html).toContain('tooltip-extra');
    expect(html).toContain('Visits');
    expect(html).toContain('errors:3');
    expect(html).toContain('background-color:#445566');
    expect(html).toContain('background-color:#aa0000');
  });

  it('falls back to raw label, key, and value strings when tooltip formatters are absent', () => {
    const html = renderToStaticMarkup(
      <ChartContainer config={{}}>
        <ChartTooltipContent active payload={[{ dataKey: 'raw-key', value: 7 }]} />
      </ChartContainer>
    );

    expect(html).not.toContain('mb-2 text-xs font-medium');
    expect(html).toContain('raw-key');
    expect(html).toContain('>7<');
    expect(html).toContain('background-color:var(--color-raw-key)');
  });

  it('returns null for inactive or empty tooltip payloads', () => {
    expect(
      renderToStaticMarkup(
        <ChartContainer config={{ visits: { label: 'Visits' } }}>
          <ChartTooltipContent active={false} payload={[{ dataKey: 'visits', value: 42 }]} />
        </ChartContainer>
      )
    ).not.toContain('min-w-44');

    expect(
      renderToStaticMarkup(
        <ChartContainer config={{ visits: { label: 'Visits' } }}>
          <ChartTooltipContent active payload={[]} />
        </ChartContainer>
      )
    ).not.toContain('min-w-44');
  });

  it('renders legend content and falls back to raw keys when config labels are missing', () => {
    const html = renderToStaticMarkup(
      <ChartContainer
        config={{
          visits: { label: 'Visits', color: '#123456' }
        }}
      >
        <ChartLegendContent
          className="legend-extra"
          payload={[{ dataKey: 'visits' }, { value: 'errors', color: '#ff0000' }]}
        />
      </ChartContainer>
    );

    expect(html).toContain('legend-extra');
    expect(html).toContain('Visits');
    expect(html).toContain('errors');
    expect(html).toContain('background-color:#123456');
    expect(html).toContain('background-color:#ff0000');
  });

  it('falls back to derived legend keys and css variables when data is sparse', () => {
    const html = renderToStaticMarkup(
      <ChartContainer config={{}}>
        <ChartLegendContent payload={[{ dataKey: undefined, value: undefined }]} />
      </ChartContainer>
    );

    expect(html).toContain('background-color:var(--color-)');
    expect(html).toContain('<span></span>');
  });

  it('returns null for empty legend payloads and requires chart context', () => {
    expect(
      renderToStaticMarkup(
        <ChartContainer config={{ visits: { label: 'Visits' } }}>
          <ChartLegendContent payload={[]} />
        </ChartContainer>
      )
    ).not.toContain('justify-center');

    expect(() => renderToStaticMarkup(<ChartTooltipContent active payload={[{ dataKey: 'x', value: 1 }]} />)).toThrow(
      'Chart components must be used within ChartContainer.'
    );
    expect(() => renderToStaticMarkup(<ChartLegendContent payload={[{ dataKey: 'x' }]} />)).toThrow(
      'Chart components must be used within ChartContainer.'
    );
  });
});
