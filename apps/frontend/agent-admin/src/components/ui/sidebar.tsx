import * as React from 'react';
import { PanelLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SidebarProviderProps extends React.ComponentProps<'div'> {
  style?: React.CSSProperties;
}

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebarContext() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('Sidebar components must be used inside SidebarProvider.');
  }
  return context;
}

function SidebarProvider({ className, children, style, ...props }: SidebarProviderProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div
        data-slot="sidebar-provider"
        data-collapsible={collapsed ? 'icon' : 'expanded'}
        style={style}
        className={cn('group/sidebar-wrapper flex min-h-screen w-full bg-background text-foreground', className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'aside'> & { variant?: 'default' | 'inset' }) {
  const { collapsed } = useSidebarContext();

  return (
    <aside
      data-slot="sidebar"
      data-collapsible={collapsed ? 'icon' : 'expanded'}
      data-variant={variant}
      className={cn(
        'hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:w-[var(--sidebar-width,16rem)] md:flex-col',
        variant === 'inset' ? 'm-0 rounded-none border-r border-border bg-sidebar shadow-none' : '',
        collapsed ? 'md:w-20' : '',
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]/sidebar-wrapper:overflow-hidden',
        className
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
}

function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
  const { collapsed, setCollapsed } = useSidebarContext();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={cn(
        'absolute inset-y-0 right-0 hidden w-4 translate-x-1/2 transition hover:after:bg-sidebar-border md:flex',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-px',
        className
      )}
      onClick={() => setCollapsed(current => !current)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sidebar-group" className={cn('relative flex w-full min-w-0 flex-col p-2', className)} {...props} />
  );
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 transition-[margin,opacity]',
        'group-data-[collapsible=icon]/sidebar-wrapper:-mt-8 group-data-[collapsible=icon]/sidebar-wrapper:opacity-0',
        className
      )}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="sidebar-menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" className={cn('group/menu-item relative', className)} {...props} />;
}

function SidebarMenuButton({
  className,
  isActive,
  children,
  ...props
}: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-button"
      data-active={isActive ? 'true' : 'false'}
      className={cn(
        'flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm outline-none transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring',
        'group-data-[collapsible=icon]/sidebar-wrapper:mx-auto group-data-[collapsible=icon]/sidebar-wrapper:size-12 group-data-[collapsible=icon]/sidebar-wrapper:justify-center group-data-[collapsible=icon]/sidebar-wrapper:p-0',
        isActive ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5',
        'group-data-[collapsible=icon]/sidebar-wrapper:hidden',
        className
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-sub-item" className={cn('group/menu-sub-item relative', className)} {...props} />;
}

function SidebarMenuSubButton({
  className,
  isActive,
  ...props
}: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-sub-button"
      data-active={isActive ? 'true' : 'false'}
      className={cn(
        'flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm text-sidebar-foreground outline-none transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : '',
        className
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sidebar-inset" className={cn('flex min-w-0 flex-1 flex-col bg-background', className)} {...props}>
      {children}
    </div>
  );
}

function SidebarTrigger({ className, ...props }: React.ComponentProps<'button'>) {
  const { collapsed, setCollapsed } = useSidebarContext();

  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted',
        className
      )}
      onClick={() => setCollapsed(current => !current)}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
};
