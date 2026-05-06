import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/utils/utils';

export function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="Breadcrumb" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return <ol className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('inline-flex items-center gap-2', className)} {...props} />;
}

export function BreadcrumbLink({ className, ...props }: React.ComponentProps<'a'>) {
  return (
    <a className={cn('font-medium text-muted-foreground transition hover:text-foreground', className)} {...props} />
  );
}

export function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return <span aria-current="page" className={cn('font-medium text-foreground', className)} {...props} />;
}

export function BreadcrumbSeparator({ className, children, ...props }: React.ComponentProps<'li'>) {
  return (
    <li aria-hidden="true" className={cn('text-muted-foreground/70', className)} {...props}>
      {children ?? <ChevronRight className="h-3.5 w-3.5" />}
    </li>
  );
}
