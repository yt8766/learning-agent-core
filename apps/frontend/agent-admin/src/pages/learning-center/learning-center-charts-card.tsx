import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { LearningChartKey } from './learning-center-panel-support';

const learningQueueConfig = {
  taskLearning: { label: 'task-learning', color: 'var(--chart-1)' },
  dreamTask: { label: 'dream-task', color: 'var(--chart-2)' }
} satisfies ChartConfig;

const learningConflictConfig = {
  open: { label: 'open', color: 'var(--chart-3)' },
  merged: { label: 'merged', color: 'var(--chart-1)' },
  dismissed: { label: 'dismissed', color: 'var(--chart-4)' },
  escalated: { label: 'escalated', color: 'var(--chart-5)' }
} satisfies ChartConfig;

const learningMinistryConfig = {
  score: { label: 'Average Score', color: 'var(--chart-2)' }
} satisfies ChartConfig;

const learningTrustConfig = {
  high: { label: 'high', color: 'var(--chart-1)' },
  medium: { label: 'medium', color: 'var(--chart-3)' },
  low: { label: 'low', color: 'var(--chart-5)' }
} satisfies ChartConfig;

export function LearningChartsCard({
  activeChart,
  onChartChange,
  queueModeData,
  conflictData,
  ministryScoreData,
  trustDistributionData
}: {
  activeChart: LearningChartKey;
  onChartChange: (value: LearningChartKey) => void;
  queueModeData: Array<{ key: string; label: string; value: number }>;
  conflictData: Array<{ key: string; label: string; value: number }>;
  ministryScoreData: Array<{ ministry: string; score: number }>;
  trustDistributionData: Array<{ key: string; label: string; value: number }>;
}) {
  const meta = {
    queue: {
      title: 'Learning Queue Structure',
      description: '查看 task-learning 与 dream-task 的沉淀结构。',
      empty: '当前还没有可视化的学习队列结构。'
    },
    conflict: {
      title: 'Conflict Governance',
      description: '查看冲突治理压力和处理结果分布。',
      empty: '当前没有可视化的冲突治理数据。'
    },
    ministry: {
      title: 'Ministry Scorecards',
      description: '查看六部长期治理分数。',
      empty: '当前还没有 ministry 评分数据。'
    },
    trust: {
      title: 'Capability Trust Distribution',
      description: '查看 capability trust 的层级分布。',
      empty: '当前还没有 capability trust 分布。'
    }
  }[activeChart];

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="gap-4 border-b border-[#ecece8] pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold text-foreground">{meta.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeChart === 'queue' ? 'default' : 'ghost'}
            onClick={() => onChartChange('queue')}
          >
            Queue
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'conflict' ? 'default' : 'ghost'}
            onClick={() => onChartChange('conflict')}
          >
            Conflict
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'ministry' ? 'default' : 'ghost'}
            onClick={() => onChartChange('ministry')}
          >
            Ministry
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'trust' ? 'default' : 'ghost'}
            onClick={() => onChartChange('trust')}
          >
            Trust
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {activeChart === 'queue' ? (
          queueModeData.some(item => item.value > 0) ? (
            <ChartContainer config={learningQueueConfig}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
                <Pie
                  data={queueModeData}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={72}
                  outerRadius={112}
                  paddingAngle={4}
                >
                  {queueModeData.map(item => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}

        {activeChart === 'conflict' ? (
          conflictData.some(item => item.value > 0) ? (
            <ChartContainer config={learningConflictConfig}>
              <BarChart data={conflictData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={56} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
                <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                  {conflictData.map(item => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}

        {activeChart === 'ministry' ? (
          ministryScoreData.length ? (
            <ChartContainer config={learningMinistryConfig}>
              <RadarChart data={ministryScoreData} outerRadius={110}>
                <PolarGrid />
                <PolarAngleAxis dataKey="ministry" tick={{ fill: 'var(--muted-foreground)' }} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toFixed(1)} />} />
                <Radar dataKey="score" fill="var(--color-score)" fillOpacity={0.28} stroke="var(--color-score)" />
              </RadarChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}

        {activeChart === 'trust' ? (
          trustDistributionData.some(item => item.value > 0) ? (
            <ChartContainer config={learningTrustConfig}>
              <BarChart data={trustDistributionData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={56} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
                <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                  {trustDistributionData.map(item => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
