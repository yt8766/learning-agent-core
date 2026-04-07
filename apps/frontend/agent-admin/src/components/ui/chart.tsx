import * as React from 'react';
import { Legend as RechartsLegend, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label: string;
    color?: string;
  }
>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('Chart components must be used within ChartContainer.');
  }
  return context;
}

export function ChartContainer({
  config,
  className,
  children
}: {
  config: ChartConfig;
  className?: string;
  children: React.ReactNode;
}) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, value], index) => [
      `--color-${key}`,
      value.color ?? `var(--chart-${(index % 5) + 1})`
    ])
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        style={style}
        className={cn(
          'h-[340px] w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/80 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-none [&_.recharts-legend-item-text]:text-foreground [&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border/80',
          className
        )}
      >
        {typeof window === 'undefined' ? (
          <div className="h-full w-full">{children}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsTooltip;
export const ChartLegend = RechartsLegend;

type ChartTooltipPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  labelFormatter,
  formatter
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  className?: string;
  labelFormatter?: (value: string | number | undefined) => React.ReactNode;
  formatter?: (value: number | string, name: string) => React.ReactNode;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={cn('min-w-44 rounded-2xl border border-[#e5e5e1] bg-white/95 px-3 py-2 shadow-sm', className)}>
      {typeof label !== 'undefined' ? (
        <div className="mb-2 text-xs font-medium text-foreground">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map(item => {
          const key = String(item.dataKey ?? item.name ?? '');
          const entry = config[key];
          const dotColor = entry?.color ?? item.color ?? `var(--color-${key})`;
          return (
            <div key={key} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                <span>{entry?.label ?? item.name ?? key}</span>
              </div>
              <span className="font-medium text-foreground">
                {formatter ? formatter(item.value ?? '', key) : String(item.value ?? '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegendContent({
  payload,
  className
}: {
  payload?: Array<{ dataKey?: string | number; value?: string | number; color?: string }>;
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-4 pt-2', className)}>
      {payload.map(item => {
        const key = String(item.dataKey ?? item.value ?? '');
        const entry = config[key];
        const dotColor = entry?.color ?? item.color ?? `var(--color-${key})`;
        return (
          <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
            <span>{entry?.label ?? item.value ?? key}</span>
          </div>
        );
      })}
    </div>
  );
}
