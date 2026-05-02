import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DashboardEmptyState, DashboardToolbar } from '@/components/dashboard-center-shell';

import type { LearningCenterRecord } from '@/types/admin';

export function LearningOperationsSections(props: {
  learning: LearningCenterRecord;
  loading: boolean;
  filteredSelectors: NonNullable<LearningCenterRecord['counselorSelectorConfigs']>;
  selectorDomainFilter: string;
  onSelectorDomainFilterChange: (value: string) => void;
  selectorFeatureFlagFilter: string;
  onSelectorFeatureFlagFilterChange: (value: string) => void;
  onEditCounselorSelector: (selector: NonNullable<LearningCenterRecord['counselorSelectorConfigs']>[number]) => void;
  onEnableCounselorSelector: (selectorId: string) => void;
  onDisableCounselorSelector: (selectorId: string) => void;
  onSetLearningConflictStatus: (
    conflictId: string,
    status: 'open' | 'merged' | 'dismissed' | 'escalated',
    preferredMemoryId?: string
  ) => void;
}) {
  const {
    learning,
    loading,
    filteredSelectors,
    onSelectorDomainFilterChange,
    onSelectorFeatureFlagFilterChange,
    onEditCounselorSelector,
    onEnableCounselorSelector,
    onDisableCounselorSelector,
    onSetLearningConflictStatus
  } = props;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">Counselor Selector Configs</CardTitle>
            <p className="text-xs text-muted-foreground">管理群辅灰度 selector 的启停、fallback 和分流策略。</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DashboardToolbar title="Selector Filters">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={props.selectorDomainFilter}
                onChange={event => onSelectorDomainFilterChange(event.target.value)}
                placeholder="按 domain 过滤"
              />
              <Input
                value={props.selectorFeatureFlagFilter}
                onChange={event => onSelectorFeatureFlagFilterChange(event.target.value)}
                placeholder="按 feature flag 过滤"
              />
            </div>
          </DashboardToolbar>
          {!filteredSelectors.length ? (
            <DashboardEmptyState message="当前还没有持久化的群辅 selector 配置。" />
          ) : (
            filteredSelectors.map(item => (
              <article key={item.selectorId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.enabled ? 'secondary' : 'outline'}>
                    {item.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                  <Badge variant="outline">{item.strategy}</Badge>
                  <Badge variant="outline">{item.domain}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{item.selectorId}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  default {item.defaultCounselorId}
                  {item.featureFlag ? ` / flag ${item.featureFlag}` : ''}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{item.candidateIds.join(' / ')}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEditCounselorSelector(item)} disabled={loading}>
                    编辑
                  </Button>
                  {item.enabled ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDisableCounselorSelector(item.selectorId)}
                      disabled={loading}
                    >
                      停用
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEnableCounselorSelector(item.selectorId)}
                      disabled={loading}
                    >
                      启用
                    </Button>
                  )}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Learning Conflict Scan</CardTitle>
          <Badge variant="outline">{learning.learningConflictScan?.conflictPairs.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {learning.learningConflictScan?.scannedAt ? (
            <p className="text-xs text-muted-foreground">last scanned {learning.learningConflictScan.scannedAt}</p>
          ) : null}
          {learning.learningConflictScan?.mergeSuggestions.length ? (
            <div className="grid gap-3">
              {learning.learningConflictScan.mergeSuggestions.map(item => (
                <article
                  key={item.conflictId}
                  className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-foreground">{item.conflictId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.suggestion}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.loserMemoryIds.join(' / ')}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetLearningConflictStatus(item.conflictId, 'merged', item.preferredMemoryId)}
                      disabled={loading}
                    >
                      接受合并建议
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetLearningConflictStatus(item.conflictId, 'escalated', item.preferredMemoryId)}
                      disabled={loading}
                    >
                      升级处理
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {!learning.learningConflictScan?.conflictPairs.length ? (
            <DashboardEmptyState message="当前没有检测到需要治理的经验冲突。" />
          ) : (
            learning.learningConflictScan.conflictPairs.map(item => (
              <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{item.recommendation}</Badge>
                  {item.riskLevel ? <Badge variant="outline">{item.riskLevel}</Badge> : null}
                  <Badge variant="secondary">spread {item.effectivenessSpread.toFixed(2)}</Badge>
                  {item.status ? <Badge variant="outline">{item.status}</Badge> : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{item.contextSignature}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.memoryIds.join(' / ')}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSetLearningConflictStatus(item.id, 'dismissed')}
                    disabled={loading}
                  >
                    挂起
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSetLearningConflictStatus(item.id, 'open')}
                    disabled={loading}
                  >
                    重新打开
                  </Button>
                </div>
              </article>
            ))
          )}
          {learning.learningConflictScan?.manualReviewQueue.length ? (
            <div className="grid gap-2">
              {learning.learningConflictScan.manualReviewQueue.map(item => (
                <article key={item.id} className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-4">
                  <p className="text-xs text-amber-700">
                    manual review: {item.contextSignature} / {item.resolution}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetLearningConflictStatus(item.id, 'merged', item.preferredMemoryId)}
                      disabled={loading}
                    >
                      标记已完成
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetLearningConflictStatus(item.id, 'escalated', item.preferredMemoryId)}
                      disabled={loading}
                    >
                      升级
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
