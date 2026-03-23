import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { SkillRecord } from '../../types/admin';

interface SkillLabPanelProps {
  skills: SkillRecord[];
  loading: boolean;
  onPromote: (skillId: string) => void;
  onDisable: (skillId: string) => void;
}

export function SkillLabPanel({ skills, loading, onPromote, onDisable }: SkillLabPanelProps) {
  return (
    <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-semibold text-stone-900">技能实验区</CardTitle>
        <Badge variant="outline">{skills.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {skills.map(skill => (
          <article key={skill.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm font-semibold text-stone-900">{skill.name}</strong>
              <Badge variant={skill.status === 'stable' ? 'success' : 'outline'}>{skill.status}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-700">{skill.description}</p>
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
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
