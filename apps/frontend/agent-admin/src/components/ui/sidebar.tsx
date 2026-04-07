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
        className={cn('group/sidebar-wrapper flex min-h-screen w-full bg-[#fdfdfc] text-foreground', className)}
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
        'hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:w-[var(--sidebar-width,21rem)] md:flex-col',
        variant === 'inset' ? 'm-0 rounded-none border-r border-border bg-[#fbfbfa] shadow-none' : '',
        collapsed ? 'md:w-18' : '',
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
    <div data-slot="sidebar-inset" className={cn('flex min-w-0 flex-1 flex-col bg-[#fdfdfc]', className)} {...props}>
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

export { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger };
