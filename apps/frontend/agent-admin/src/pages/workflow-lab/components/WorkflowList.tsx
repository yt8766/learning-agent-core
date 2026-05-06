import { Play } from 'lucide-react';

import { cn } from '@/utils/utils';

import type { WorkflowDefinition } from '../registry/workflow.registry';

interface WorkflowListProps {
  workflows: WorkflowDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function WorkflowList({ workflows, selectedId, onSelect }: WorkflowListProps) {
  return (
    <section className="grid gap-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">工作流</p>
      <div className="grid gap-2">
        {workflows.map(workflow => (
          <button
            key={workflow.id}
            type="button"
            onClick={() => onSelect(workflow.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
              selectedId === workflow.id
                ? 'border-emerald-500 bg-emerald-50/70 text-foreground'
                : 'border-border/70 bg-muted/30 text-foreground hover:bg-muted/50'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                selectedId === workflow.id
                  ? 'border-emerald-200 bg-white text-emerald-700'
                  : 'border-border bg-background text-muted-foreground'
              )}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{workflow.name}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{workflow.id}</span>
              <span className="mt-2 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                {workflow.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
