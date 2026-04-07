import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { PlatformConsoleRecord } from '@/types/admin';

export function SkillSourcesInstalledCard(props: {
  item: PlatformConsoleRecord['skillSources']['installed'][number];
  onSelectTask: (taskId: string) => void;
}) {
  const { item } = props;
  return (
    <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{item.skillId}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.installLocation}</p>
        </div>
        <Badge variant={item.status === 'installed' ? 'success' : 'warning'}>{item.status}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary">v{item.version}</Badge>
        <Badge variant="secondary">{item.sourceId}</Badge>
        {typeof item.successRate === 'number' ? (
          <Badge variant="outline">success {(item.successRate * 100).toFixed(0)}%</Badge>
        ) : null}
        {item.governanceRecommendation ? (
          <Badge variant="outline">suggest {item.governanceRecommendation}</Badge>
        ) : null}
        {typeof item.activeTaskCount === 'number' ? (
          <Badge variant="outline">active {item.activeTaskCount}</Badge>
        ) : null}
        {typeof item.totalTaskCount === 'number' ? <Badge variant="outline">used {item.totalTaskCount}</Badge> : null}
      </div>
      {item.recentTaskGoals?.length ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent Goals</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {item.recentTaskGoals.map(goal => (
              <li key={`${item.skillId}-${goal}`}>{goal}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {item.recentTasks?.length ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Task Drill-down</p>
          <div className="mt-2 grid gap-2">
            {item.recentTasks.map(task => (
              <div
                key={`${item.skillId}-${task.taskId}`}
                className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{task.goal}</p>
                    <p className="mt-1 text-muted-foreground">
                      {task.taskId} · {task.status} · approvals {task.approvalCount}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => props.onSelectTask(task.taskId)}>
                    查看任务
                  </Button>
                </div>
                {task.latestTraceSummary ? (
                  <p className="mt-2 text-muted-foreground">{task.latestTraceSummary}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {item.firstUsedAt ? <p className="mt-2 text-xs text-muted-foreground">first used {item.firstUsedAt}</p> : null}
      {item.lastUsedAt ? <p className="mt-1 text-xs text-muted-foreground">last used {item.lastUsedAt}</p> : null}
      {item.lastOutcome ? <p className="mt-1 text-xs text-muted-foreground">last outcome {item.lastOutcome}</p> : null}
      {item.recentFailureReason ? (
        <p className="mt-1 text-xs text-rose-600">recent failure: {item.recentFailureReason}</p>
      ) : null}
      {item.compatibility ? <p className="mt-3 text-xs text-muted-foreground">{item.compatibility}</p> : null}
      {item.allowedTools?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.allowedTools.map(tool => (
            <span key={`${item.skillId}-tool-${tool}`}>
              <Badge variant="outline">{tool}</Badge>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
