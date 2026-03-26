import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { PlatformConsoleRecord } from '../../types/admin';

interface SkillSourcesCenterPanelProps {
  skillSources: PlatformConsoleRecord['skillSources'];
  onSelectTask: (taskId: string) => void;
  onInstallSkill: (manifestId: string, sourceId?: string) => void;
  onApproveInstall: (receiptId: string) => void;
  onRejectInstall: (receiptId: string) => void;
  onEnableSource: (sourceId: string) => void;
  onDisableSource: (sourceId: string) => void;
  onSyncSource: (sourceId: string) => void;
}

export function SkillSourcesCenterPanel({
  skillSources,
  onSelectTask,
  onInstallSkill,
  onApproveInstall,
  onRejectInstall,
  onEnableSource,
  onDisableSource,
  onSyncSource
}: SkillSourcesCenterPanelProps) {
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
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Installed Effectiveness</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">
              {installedAvgSuccessRate == null ? 'N/A' : `${Math.round(installedAvgSuccessRate * 100)}%`}
            </p>
            <p className="mt-2 text-sm text-stone-500">已安装 skill 的平均成功率。</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Skill Usage</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">{installedUsageCount}</p>
            <p className="mt-2 text-sm text-stone-500">已安装 skill 参与过的任务总次数。</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Governance Coverage</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">{governedSkills}</p>
            <p className="mt-2 text-sm text-stone-500">已有治理建议的 installed skills 数量。</p>
          </CardContent>
        </Card>
      </div>

      {highLeverageSkills.length || reviewNeededSkills.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">High Leverage Skills</p>
              <div className="mt-3 grid gap-2">
                {highLeverageSkills.length ? (
                  highLeverageSkills.map(item => (
                    <div
                      key={`top-skill-${item.skillId}`}
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-stone-900">{item.skillId}</span>
                        <Badge variant="success">{Math.round((item.successRate ?? 0) * 100)}%</Badge>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        used {item.totalTaskCount ?? 0} · source {item.sourceId}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">当前还没有足够运行数据。</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Review Needed</p>
              <div className="mt-3 grid gap-2">
                {reviewNeededSkills.length ? (
                  reviewNeededSkills.map(item => (
                    <div
                      key={`review-skill-${item.skillId}`}
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-stone-900">{item.skillId}</span>
                        <Badge variant="warning">{item.governanceRecommendation ?? 'review'}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        success {item.successRate == null ? 'N/A' : `${Math.round(item.successRate * 100)}%`}
                      </p>
                      {item.recentFailureReason ? (
                        <p className="mt-1 text-xs text-rose-600">{item.recentFailureReason}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">当前没有明显异常 skill。</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Skill Sources / Marketplace</CardTitle>
          <Badge variant="outline">{skillSources.sources.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {skillSources.sources.map(source => (
            <article key={source.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{source.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{source.baseUrl}</p>
                </div>
                <Badge variant={source.enabled ? 'success' : 'secondary'}>{source.healthState ?? 'unknown'}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{source.kind}</Badge>
                {source.discoveryMode ? <Badge variant="secondary">{source.discoveryMode}</Badge> : null}
                <Badge variant="secondary">{source.priority}</Badge>
                <Badge variant="secondary">{source.trustClass}</Badge>
                {source.syncStrategy ? <Badge variant="secondary">sync {source.syncStrategy}</Badge> : null}
                {source.profilePolicy ? (
                  <Badge variant={source.profilePolicy.enabledByProfile ? 'success' : 'warning'}>
                    profile {source.profilePolicy.enabledByProfile ? 'allowed' : 'restricted'}
                  </Badge>
                ) : null}
                {source.authMode ? <Badge variant="secondary">auth {source.authMode}</Badge> : null}
              </div>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => (source.enabled ? onDisableSource(source.id) : onEnableSource(source.id))}
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                  >
                    {source.enabled ? '停用来源' : '启用来源'}
                  </button>
                  {(source.discoveryMode ?? 'local-dir') !== 'local-dir' ? (
                    <button
                      type="button"
                      onClick={() => onSyncSource(source.id)}
                      className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                    >
                      Sync Now
                    </button>
                  ) : null}
                </div>
              </div>
              {source.healthReason ? <p className="mt-3 text-xs text-stone-500">{source.healthReason}</p> : null}
              {source.indexUrl ? <p className="mt-1 text-xs text-stone-500">index: {source.indexUrl}</p> : null}
              {source.packageBaseUrl ? (
                <p className="mt-1 text-xs text-stone-500">package: {source.packageBaseUrl}</p>
              ) : null}
              {source.lastSyncedAt ? (
                <p className="mt-1 text-xs text-stone-500">last synced {source.lastSyncedAt}</p>
              ) : null}
              {source.profilePolicy ? (
                <p className="mt-1 text-xs text-stone-500">profile policy: {source.profilePolicy.reason}</p>
              ) : null}
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Available Manifests</CardTitle>
          <Badge variant="outline">{skillSources.manifests.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {skillSources.manifests.map(manifest => (
            <article key={manifest.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">
                    {manifest.name} <span className="text-stone-400">v{manifest.version}</span>
                  </p>
                  <p className="mt-1 text-sm text-stone-600">{manifest.description}</p>
                </div>
                <Badge variant="secondary">{manifest.riskLevel}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{manifest.publisher}</Badge>
                <Badge variant="secondary">{manifest.approvalPolicy}</Badge>
                {manifest.license ? <Badge variant="secondary">{manifest.license}</Badge> : null}
                {manifest.publishedAt ? <Badge variant="outline">{manifest.publishedAt}</Badge> : null}
                {manifest.safety ? <Badge variant="outline">{manifest.safety.verdict}</Badge> : null}
                {manifest.safety ? <Badge variant="outline">trust {manifest.safety.trustScore}</Badge> : null}
                {manifest.requiredConnectors?.map(item => (
                  <span key={`${manifest.id}-${item}`}>
                    <Badge variant="outline">{item}</Badge>
                  </span>
                ))}
                {manifest.allowedTools?.map(item => (
                  <span key={`${manifest.id}-tool-${item}`}>
                    <Badge variant="outline">{item}</Badge>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-stone-500">{manifest.summary ?? manifest.entry}</p>
              {manifest.artifactUrl ? (
                <p className="mt-1 text-xs text-stone-500">artifact: {manifest.artifactUrl}</p>
              ) : null}
              {manifest.homepageUrl ? (
                <p className="mt-1 text-xs text-stone-500">homepage: {manifest.homepageUrl}</p>
              ) : null}
              {manifest.compatibility ? <p className="mt-1 text-xs text-stone-500">{manifest.compatibility}</p> : null}
              {typeof manifest.sizeBytes === 'number' ? (
                <p className="mt-1 text-xs text-stone-500">size {manifest.sizeBytes} bytes</p>
              ) : null}
              {manifest.safety?.reasons.length ? (
                <p className="mt-1 text-xs text-stone-500">{manifest.safety.reasons.join('；')}</p>
              ) : null}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onInstallSkill(manifest.id, manifest.sourceId)}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  安装到 Skill Lab
                </button>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-950">Installed Skills</CardTitle>
            <Badge variant="outline">{skillSources.installed.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {skillSources.installed.map(item => (
              <article
                key={`${item.skillId}-${item.version}`}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{item.skillId}</p>
                    <p className="mt-1 text-xs text-stone-500">{item.installLocation}</p>
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
                  {typeof item.totalTaskCount === 'number' ? (
                    <Badge variant="outline">used {item.totalTaskCount}</Badge>
                  ) : null}
                </div>
                {item.recentTaskGoals?.length ? (
                  <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Recent Goals</p>
                    <ul className="mt-2 space-y-1 text-sm text-stone-600">
                      {item.recentTaskGoals.map(goal => (
                        <li key={`${item.skillId}-${goal}`}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {item.recentTasks?.length ? (
                  <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Task Drill-down</p>
                    <div className="mt-2 grid gap-2">
                      {item.recentTasks.map(task => (
                        <div
                          key={`${item.skillId}-${task.taskId}`}
                          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-stone-900">{task.goal}</p>
                              <p className="mt-1 text-stone-500">
                                {task.taskId} · {task.status} · approvals {task.approvalCount}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectTask(task.taskId)}
                              className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                            >
                              查看任务
                            </button>
                          </div>
                          {task.latestTraceSummary ? (
                            <p className="mt-2 text-stone-600">{task.latestTraceSummary}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {item.firstUsedAt ? <p className="mt-2 text-xs text-stone-500">first used {item.firstUsedAt}</p> : null}
                {item.lastUsedAt ? <p className="mt-1 text-xs text-stone-500">last used {item.lastUsedAt}</p> : null}
                {item.lastOutcome ? (
                  <p className="mt-1 text-xs text-stone-500">last outcome {item.lastOutcome}</p>
                ) : null}
                {item.recentFailureReason ? (
                  <p className="mt-1 text-xs text-rose-600">recent failure: {item.recentFailureReason}</p>
                ) : null}
                {item.compatibility ? <p className="mt-3 text-xs text-stone-500">{item.compatibility}</p> : null}
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
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-950">Install Receipts</CardTitle>
            <Badge variant="outline">{skillSources.receipts.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {skillSources.receipts.map(item => (
              <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{item.skillId}</p>
                    <p className="mt-1 text-xs text-stone-500">{item.result ?? 'pending result'}</p>
                  </div>
                  <Badge variant={item.status === 'installed' ? 'success' : 'secondary'}>{item.status}</Badge>
                </div>
                {item.phase ? <p className="mt-2 text-xs text-stone-500">phase: {item.phase}</p> : null}
                {item.downloadRef ? <p className="mt-1 text-xs text-stone-500">download: {item.downloadRef}</p> : null}
                {item.failureCode ? <p className="mt-1 text-xs text-rose-600">failure: {item.failureCode}</p> : null}
                {item.failureDetail ? <p className="mt-1 text-xs text-stone-500">{item.failureDetail}</p> : null}
                {item.status === 'pending' ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onApproveInstall(item.id)}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                    >
                      批准安装
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectInstall(item.id)}
                      className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-700"
                    >
                      拒绝安装
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
