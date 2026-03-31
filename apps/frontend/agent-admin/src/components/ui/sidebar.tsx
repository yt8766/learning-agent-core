import * as React from 'react';

import { cn } from '@/lib/utils';

interface SidebarProviderProps extends React.ComponentProps<'div'> {
  style?: React.CSSProperties;
}

function SidebarProvider({ className, children, style, ...props }: SidebarProviderProps) {
  return (
    <div
      data-slot="sidebar-provider"
      style={style}
      className={cn('flex min-h-screen w-full bg-muted/30 text-foreground', className)}
      {...props}
    >
      {children}
    </div>
  );
}

function Sidebar({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'aside'> & { variant?: 'default' | 'inset' }) {
  return (
    <aside
      data-slot="sidebar"
      data-variant={variant}
      className={cn(
        'hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:w-[var(--sidebar-width,18rem)] md:flex-col',
        variant === 'inset'
          ? 'm-3 mr-0 rounded-3xl border border-border/70 bg-background/95 shadow-none backdrop-blur'
          : '',
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

function SidebarInset({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sidebar-inset" className={cn('flex min-w-0 flex-1 flex-col', className)} {...props}>
      {children}
    </div>
  );
}

export { Sidebar, SidebarInset, SidebarProvider };
