import ReactECharts from 'echarts-for-react';

export interface KnowledgeOverviewChartPoint {
  label: string;
  value: number;
}

interface KnowledgeOverviewChartProps {
  color: string;
  data: KnowledgeOverviewChartPoint[];
  height?: number;
  name: string;
  type: 'bar' | 'line';
  unit?: string;
}

export function KnowledgeOverviewChart({ color, data, height = 220, name, type, unit }: KnowledgeOverviewChartProps) {
  function formatTooltip(params: unknown) {
    const point = Array.isArray(params) ? params[0] : params;
    if (!isTooltipPoint(point)) {
      return '';
    }
    return `${point.marker}${point.name}<br/>${name}: ${point.value}${unit ?? ''}`;
  }

  const option = {
    color: [color],
    grid: {
      bottom: 28,
      left: 36,
      right: 18,
      top: 28
    },
    series: [
      {
        areaStyle:
          type === 'line'
            ? {
                color
              }
            : undefined,
        barMaxWidth: 28,
        data: data.map(point => point.value),
        emphasis: {
          focus: 'series'
        },
        name,
        smooth: type === 'line',
        symbol: type === 'line' ? 'circle' : undefined,
        symbolSize: 7,
        type
      }
    ],
    tooltip: {
      confine: true,
      formatter: formatTooltip,
      trigger: 'axis'
    },
    xAxis: {
      axisLabel: {
        color: '#6b7280'
      },
      axisLine: {
        lineStyle: {
          color: '#d9d9d9'
        }
      },
      axisTick: {
        show: false
      },
      data: data.map(point => point.label),
      type: 'category'
    },
    yAxis: {
      axisLabel: {
        color: '#6b7280',
        formatter: `{value}${unit ?? ''}`
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      },
      type: 'value'
    }
  };

  return <ReactECharts className="knowledge-overview-chart" option={option} style={{ height, width: '100%' }} />;
}

function isTooltipPoint(value: unknown): value is { marker: string; name: string; value: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const point = value as Record<string, unknown>;
  return typeof point.marker === 'string' && typeof point.name === 'string' && typeof point.value === 'number';
}
