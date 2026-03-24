import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuleRecord, SkillRecord } from '../../types/admin';

interface SkillLabPanelProps {
  skills: SkillRecord[];
  rules: RuleRecord[];
  loading: boolean;
  onPromote: (skillId: string) => void;
  onDisable: (skillId: string) => void;
  onRestoreSkill: (skillId: string) => void;
  onRetireSkill: (skillId: string) => void;
  onInvalidateRule: (ruleId: string) => void;
  onSupersedeRule: (ruleId: string) => void;
  onRestoreRule: (ruleId: string) => void;
  onRetireRule: (ruleId: string) => void;
}

export function SkillLabPanel({
  skills,
  rules,
  loading,
  onPromote,
  onDisable,
  onRestoreSkill,
  onRetireSkill,
  onInvalidateRule,
  onSupersedeRule,
  onRestoreRule,
  onRetireRule
}: SkillLabPanelProps) {
  return (
    <div className="grid gap-6">
      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Skill Lab</CardTitle>
          <Badge variant="outline">{skills.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {skills.map(skill => (
            <article key={skill.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{skill.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{skill.id}</p>
                </div>
                <Badge
                  variant={
                    skill.status === 'stable' ? 'success' : skill.status === 'disabled' ? 'destructive' : 'outline'
                  }
                >
                  {skill.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-700">{skill.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {skill.version ? <Badge variant="secondary">v{skill.version}</Badge> : null}
                {typeof skill.successRate === 'number' ? (
                  <Badge variant="secondary">成功率 {(skill.successRate * 100).toFixed(0)}%</Badge>
                ) : null}
                {skill.promotionState ? <Badge variant="secondary">{skill.promotionState}</Badge> : null}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onPromote(skill.id)}
                  disabled={loading || skill.status === 'stable'}
                >
                  晋升
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => onDisable(skill.id)}
                  disabled={loading || skill.status === 'disabled'}
                >
                  禁用
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onRestoreSkill(skill.id)}
                  disabled={loading || skill.status !== 'disabled'}
                >
                  恢复
                </Button>
                <Button variant="destructive" onClick={() => onRetireSkill(skill.id)} disabled={loading}>
                  归档
                </Button>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Rules Governance</CardTitle>
          <Badge variant="outline">{rules.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {rules.map(rule => (
            <article key={rule.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{rule.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{rule.id}</p>
                </div>
                <Badge variant={rule.status === 'invalidated' ? 'destructive' : 'outline'}>
                  {rule.status ?? 'active'}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-700">{rule.summary}</p>
              <p className="mt-2 text-xs text-stone-500">{rule.action}</p>
              {rule.invalidationReason ? <p className="mt-2 text-xs text-red-600">{rule.invalidationReason}</p> : null}
              {rule.supersededById ? (
                <p className="mt-2 text-xs text-amber-600">替代为：{rule.supersededById}</p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => onInvalidateRule(rule.id)}
                  disabled={loading || rule.status === 'invalidated'}
                >
                  失效
                </Button>
                <Button variant="outline" onClick={() => onSupersedeRule(rule.id)} disabled={loading}>
                  替代
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onRestoreRule(rule.id)}
                  disabled={loading || rule.status === 'active'}
                >
                  恢复
                </Button>
                <Button variant="destructive" onClick={() => onRetireRule(rule.id)} disabled={loading}>
                  归档
                </Button>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
