import type * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function DashboardCenterShell({
  title,
  description,
  count,
  actions,
  children
}: {
  title: string;
  description?: string;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
              {typeof count !== 'undefined' ? <Badge variant="outline">{count}</Badge> : null}
            </div>
            {description ? <CardDescription className="max-w-3xl">{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      </Card>
      {children}
    </div>
  );
}

export function DashboardToolbar({
  title,
  description,
  children
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardContent className="grid gap-4 p-5">
        {title ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

export function DashboardMetricGrid({
  items,
  columns = 'md:grid-cols-2 xl:grid-cols-4'
}: {
  items: Array<{ label: string; value: React.ReactNode; note?: string }>;
  columns?: string;
}) {
  return (
    <div className={cn('grid gap-4', columns)}>
      {items.map(item => (
        <Card key={item.label} className="border-border/70 bg-card/90 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
            {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardEmptyState({ message, className }: { message: string; className?: string }) {
  return (
    <Card className={cn('border-dashed border-border/70 bg-muted/20 shadow-none', className)}>
      <CardContent className="p-6 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}
