import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

import { DashboardCenterShell, DashboardEmptyState, DashboardMetricGrid } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { WorkspaceCenterDraft, WorkspaceCenterPanelProps } from './workspace-center-types';

type LifecycleNextAction = NonNullable<NonNullable<WorkspaceCenterDraft['lifecycle']>['nextAction']>;
type InstallStatus = NonNullable<WorkspaceCenterDraft['install']>['status'] | string | undefined;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function canDecideDraft(status: string) {
  return status === 'draft' || status === 'shadow';
}

const lifecycleActionLabels: Record<LifecycleNextAction, string> = {
  review_draft: '复核草稿',
  install_from_skill_lab: '从 Skill Lab 安装',
  approve_install: '批准安装',
  retry_install: '重试安装',
  ready_to_reuse: '可复用',
  none: '无需动作'
};

function getLifecycleActionLabel(nextAction?: LifecycleNextAction) {
  return nextAction ? lifecycleActionLabels[nextAction] : '未声明下一步';
}

function getInstallStatusLabel(status: InstallStatus) {
  return status === 'failed' ? '安装失败' : (status ?? '未请求');
}

function groupDraftsByLifecycleAction(drafts: WorkspaceCenterDraft[]) {
  return drafts.reduce<Array<{ action: string; count: number }>>((groups, draft) => {
    const action = getLifecycleActionLabel(draft.lifecycle?.nextAction);
    const existingGroup = groups.find(group => group.action === action);

    if (existingGroup) {
      existingGroup.count += 1;
      return groups;
    }

    return [...groups, { action, count: 1 }];
  }, []);
}

export function WorkspaceCenterPanel({ workspaceCenter, onApproveDraft, onRejectDraft }: WorkspaceCenterPanelProps) {
  const { workspace, drafts, reuseRecords } = workspaceCenter;
  const summary = workspace.summary;
  const activeDraftCount = summary?.activeDraftCount ?? drafts.length;
  const approvedDraftCount = summary?.approvedDraftCount ?? drafts.filter(draft => draft.status === 'trusted').length;
  const reuseRecordCount = summary?.reuseRecordCount ?? reuseRecords.length;
  const lifecycleActionGroups = groupDraftsByLifecycleAction(drafts);

  return (
    <DashboardCenterShell
      title="Agent Workspace"
      description="治理 workspace、技能草稿与复用记录的最小控制台入口。"
      count={workspace.scope}
      actions={<Badge variant={workspace.status === 'active' ? 'secondary' : 'outline'}>{workspace.status}</Badge>}
    >
      <div className="grid gap-4">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                {workspace.name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{workspace.owner.label}</Badge>
                <Badge variant="outline">{workspace.scope}</Badge>
                <span>更新于 {workspace.updatedAt}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DashboardMetricGrid
              columns="md:grid-cols-3"
              items={[
                { label: '活跃草稿', value: activeDraftCount, note: '等待治理动作的 workspace drafts' },
                { label: '已批准草稿', value: approvedDraftCount, note: '已进入可信或可复用状态' },
                { label: '复用记录', value: reuseRecordCount, note: '来自 workspace 的技能复用信号' }
              ]}
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">技能草稿</CardTitle>
            <Badge variant="outline">{drafts.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {drafts.length === 0 ? (
              <DashboardEmptyState message="当前没有待治理的技能草稿。" />
            ) : (
              <>
                <div className="grid gap-2 rounded-lg border border-[#ecece8] bg-[#f8f8f6] p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Lifecycle 分组</p>
                  <div className="flex flex-wrap gap-2">
                    {lifecycleActionGroups.map(group => (
                      <span key={group.action}>
                        <Badge variant="outline">
                          {group.action} · {group.count}
                        </Badge>
                      </span>
                    ))}
                  </div>
                </div>
                {drafts.map(draft => {
                  const decisionEnabled = canDecideDraft(draft.status);
                  const installStatus = draft.install?.status ?? draft.lifecycle?.installStatus;
                  const installStatusLabel = getInstallStatusLabel(installStatus);
                  const lifecycleActionLabel = getLifecycleActionLabel(draft.lifecycle?.nextAction);

                  return (
                    <div key={draft.id} className="grid gap-4 rounded-xl border border-[#ecece8] bg-[#f8f8f6] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground">{draft.title}</h3>
                            <Badge variant="outline">{draft.status}</Badge>
                            <Badge variant="outline">{draft.riskLevel}</Badge>
                            <Badge variant="secondary">{formatPercent(draft.confidence)}</Badge>
                          </div>
                          {draft.description ? (
                            <p className="text-sm text-muted-foreground">{draft.description}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" disabled={!decisionEnabled} onClick={() => onApproveDraft(draft.id)}>
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            批准
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!decisionEnabled}
                            onClick={() => onRejectDraft(draft.id)}
                          >
                            <XCircle className="size-4" aria-hidden="true" />
                            拒绝
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                        <div>
                          <p className="font-medium text-foreground">来源任务</p>
                          <p>{draft.sourceTaskId}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">工具</p>
                          <p>{draft.requiredTools.length > 0 ? draft.requiredTools.join(', ') : '未声明'}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">连接器</p>
                          <p>{draft.requiredConnectors.length > 0 ? draft.requiredConnectors.join(', ') : '未声明'}</p>
                        </div>
                      </div>
                      {draft.install || draft.lifecycle ? (
                        <div className="grid gap-3 rounded-lg border border-[#ecece8] bg-white/70 p-3 text-xs text-muted-foreground md:grid-cols-3">
                          <div>
                            <p className="font-medium text-foreground">安装状态</p>
                            <p>{installStatusLabel}</p>
                            {draft.install?.failureCode ? <p>失败代码：{draft.install.failureCode}</p> : null}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">收据</p>
                            <p>{draft.install?.receiptId ?? '未生成'}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">下一步</p>
                            <p>{lifecycleActionLabel}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardCenterShell>
  );
}
