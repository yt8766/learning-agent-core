import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import type { PlatformConsoleRecord } from '@/types/admin';

export function SkillSourcesCenterSummary({ skillSources }: { skillSources: PlatformConsoleRecord['skillSources'] }) {
  const installedSuccessRates = skillSources.installed
    .map(item => item.successRate)
    .filter((value): value is number => typeof value === 'number');
  const installedAvgSuccessRate = installedSuccessRates.length
    ? installedSuccessRates.reduce((sum, value) => sum + value, 0) / installedSuccessRates.length
    : undefined;
  const installedUsageCount = skillSources.installed.reduce((sum, item) => sum + (item.totalTaskCount ?? 0), 0);
  const governedSkills = skillSources.installed.filter(item => item.governanceRecommendation).length;
  const highLeverageSkills = skillSources.installed
    .filter(item => typeof item.successRate === 'number')
    .slice()
    .sort(
      (left, right) =>
        (right.successRate ?? 0) * (right.totalTaskCount ?? 0) - (left.successRate ?? 0) * (left.totalTaskCount ?? 0)
    )
    .slice(0, 3);
  const reviewNeededSkills = skillSources.installed
    .filter(
      item =>
        item.recentFailureReason ||
        item.governanceRecommendation === 'disable' ||
        item.governanceRecommendation === 'retire' ||
        (item.successRate ?? 1) < 0.6
    )
    .slice()
    .sort((left, right) => (left.successRate ?? 1) - (right.successRate ?? 1))
    .slice(0, 3);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Installed Effectiveness"
          value={installedAvgSuccessRate == null ? 'N/A' : `${Math.round(installedAvgSuccessRate * 100)}%`}
          detail="已安装 skill 的平均成功率。"
        />
        <SummaryCard label="Skill Usage" value={installedUsageCount} detail="已安装 skill 参与过的任务总次数。" />
        <SummaryCard
          label="Governance Coverage"
          value={governedSkills}
          detail="已有治理建议的 installed skills 数量。"
        />
      </div>

      {highLeverageSkills.length || reviewNeededSkills.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <HighlightCard
            title="High Leverage Skills"
            emptyText="当前还没有足够运行数据。"
            items={highLeverageSkills.map(item => ({
              id: `top-skill-${item.skillId}`,
              title: item.skillId,
              badge: <Badge variant="success">{Math.round((item.successRate ?? 0) * 100)}%</Badge>,
              detail: `used ${item.totalTaskCount ?? 0} · source ${item.sourceId}`
            }))}
          />
          <HighlightCard
            title="Review Needed"
            emptyText="当前没有明显异常 skill。"
            items={reviewNeededSkills.map(item => ({
              id: `review-skill-${item.skillId}`,
              title: item.skillId,
              badge: <Badge variant="warning">{item.governanceRecommendation ?? 'review'}</Badge>,
              detail: `success ${item.successRate == null ? 'N/A' : `${Math.round(item.successRate * 100)}%`}`,
              note: item.recentFailureReason
            }))}
          />
        </div>
      ) : null}
    </>
  );
}

function SummaryCard(props: { label: string; value: number | string; detail: string }) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{props.label}</p>
        <p className="mt-3 text-2xl font-semibold text-foreground">{props.value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{props.detail}</p>
      </CardContent>
    </Card>
  );
}

function HighlightCard(props: {
  title: string;
  emptyText: string;
  items: Array<{ id: string; title: string; badge: React.ReactNode; detail: string; note?: string | null }>;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{props.title}</p>
        <div className="mt-3 grid gap-2">
          {props.items.length ? (
            props.items.map(item => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{item.title}</span>
                  {item.badge}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                {item.note ? <p className="mt-1 text-xs text-rose-600">{item.note}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{props.emptyText}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
