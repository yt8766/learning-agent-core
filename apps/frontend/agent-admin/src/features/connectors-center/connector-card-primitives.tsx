import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

export function ConnectorFeed(props: { title: string; items?: ReactNode[]; tone?: 'amber' | 'stone' }) {
  if (!props.items?.length) {
    return null;
  }
  const toneClass =
    props.tone === 'amber'
      ? 'mt-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-3'
      : 'mt-3 rounded-xl border border-border/70 bg-background px-3 py-3';
  const titleClass =
    props.tone === 'amber'
      ? 'text-[11px] font-medium uppercase tracking-wide text-amber-700'
      : 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground';
  return (
    <div className={toneClass}>
      <p className={titleClass}>{props.title}</p>
      <div className="mt-2 grid gap-2">{props.items}</div>
    </div>
  );
}

export function ActionButton(props: { children: ReactNode; onClick: () => void; small?: boolean }) {
  return (
    <Button type="button" onClick={props.onClick} size={props.small ? 'sm' : 'default'} variant="outline">
      {props.children}
    </Button>
  );
}
