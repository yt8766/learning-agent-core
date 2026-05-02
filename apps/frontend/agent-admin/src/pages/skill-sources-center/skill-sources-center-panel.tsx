import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardCenterShell, DashboardEmptyState } from '@/components/dashboard-center-shell';

import { SkillSourcesCenterSummary } from './skill-sources-center-summary';
import { SkillSourcesInstalledCard } from './skill-sources-installed-card';
import { SkillSourcesManifestCard } from './skill-sources-manifest-card';
import { SkillSourcesReceiptCard } from './skill-sources-receipt-card';
import { SkillSourcesSourceCard } from './skill-sources-source-card';
import type { SkillSourcesCenterPanelProps } from './skill-sources-center-types';

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
  return (
    <DashboardCenterShell
      title="技能来源治理"
      description="统一管理 marketplace、可安装 manifests、已安装技能与安装回执。"
      count={skillSources.sources.length}
    >
      <div className="grid gap-6">
        <SkillSourcesCenterSummary skillSources={skillSources} />

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">技能来源 / 市场</CardTitle>
            <Badge variant="outline">{skillSources.sources.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            {skillSources.sources.length === 0 ? (
              <DashboardEmptyState message="当前还没有技能来源。" />
            ) : (
              skillSources.sources.map(source => (
                <div key={source.id}>
                  <SkillSourcesSourceCard
                    source={source}
                    onEnableSource={onEnableSource}
                    onDisableSource={onDisableSource}
                    onSyncSource={onSyncSource}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">可安装清单</CardTitle>
            <Badge variant="outline">{skillSources.manifests.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            {skillSources.manifests.length === 0 ? (
              <DashboardEmptyState message="当前没有可安装的技能清单。" />
            ) : (
              skillSources.manifests.map(manifest => (
                <div key={manifest.id}>
                  <SkillSourcesManifestCard manifest={manifest} onInstallSkill={onInstallSkill} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground">已安装技能</CardTitle>
              <Badge variant="outline">{skillSources.installed.length}</Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              {skillSources.installed.length === 0 ? (
                <DashboardEmptyState message="当前没有已安装技能。" />
              ) : (
                skillSources.installed.map(item => (
                  <div key={`${item.skillId}-${item.version}`}>
                    <SkillSourcesInstalledCard item={item} onSelectTask={onSelectTask} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground">安装回执</CardTitle>
              <Badge variant="outline">{skillSources.receipts.length}</Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              {skillSources.receipts.length === 0 ? (
                <DashboardEmptyState message="当前没有待处理的安装回执。" />
              ) : (
                skillSources.receipts.map(item => (
                  <div key={item.id}>
                    <SkillSourcesReceiptCard
                      item={item}
                      onApproveInstall={onApproveInstall}
                      onRejectInstall={onRejectInstall}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardCenterShell>
  );
}
