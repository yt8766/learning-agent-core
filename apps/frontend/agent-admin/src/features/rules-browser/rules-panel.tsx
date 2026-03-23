import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuleRecord } from '../../types/admin';

interface RulesPanelProps {
  rules: RuleRecord[];
}

export function RulesPanel({ rules }: RulesPanelProps) {
  return (
    <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-semibold text-stone-900">规则沉淀</CardTitle>
        <Badge variant="outline">{rules.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rules.map(rule => (
          <article key={rule.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <strong className="text-sm font-semibold text-stone-900">{rule.name}</strong>
            <p className="mt-3 text-sm leading-6 text-stone-700">{rule.summary}</p>
            <small className="mt-2 block text-xs text-stone-500">{rule.action}</small>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
