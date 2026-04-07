import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { RuleRecord } from '@/types/admin';

interface RulesPanelProps {
  rules: RuleRecord[];
}

export function RulesPanel({ rules }: RulesPanelProps) {
  return (
    <Card className="col-span-12 border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-semibold text-foreground">规则沉淀</CardTitle>
        <Badge variant="outline">{rules.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rules.length ? (
          rules.map(rule => (
            <article key={rule.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <strong className="text-sm font-semibold text-foreground">{rule.name}</strong>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{rule.summary}</p>
              <small className="mt-2 block text-xs text-muted-foreground">{rule.action}</small>
            </article>
          ))
        ) : (
          <DashboardEmptyState className="md:col-span-2 xl:col-span-3" message="当前没有规则沉淀。" />
        )}
      </CardContent>
    </Card>
  );
}
