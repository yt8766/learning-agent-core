import * as React from 'react';
import { BarChart3, Link2, Plus, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { DashboardPageKey } from '@/types/admin';

interface SiteHeaderProps {
  title: string;
  page: DashboardPageKey;
  badges: string[];
  onNavigate: (page: DashboardPageKey) => void;
  onRefresh: () => void;
  onRefreshMetrics: () => void;
  onQuickCreate: () => void;
  onCopyShareLink: () => void;
}

const HEADER_NAV_ITEMS: Array<{ key: DashboardPageKey; label: string; compact?: boolean }> = [
  { key: 'runtime', label: '运行中枢' },
  { key: 'approvals', label: '审批中枢' },
  { key: 'learning', label: '学习中枢' },
  { key: 'evidence', label: '证据中心' },
  { key: 'connectors', label: '连接器与策略', compact: true },
  { key: 'skills', label: '技能工坊', compact: true }
];

export function SiteHeader(props: SiteHeaderProps) {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop);
    };

    document.addEventListener('scroll', onScroll, { passive: true });
    return () => document.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'z-50 h-16 shrink-0 border-b border-border bg-background',
        offset > 10 ? 'shadow-sm' : 'shadow-none'
      )}
    >
      <div className="relative flex h-full items-center gap-3 p-4 sm:gap-4">
        <SidebarTrigger className="max-md:scale-125" />
        <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />
        <nav className="hidden min-w-0 items-center gap-5 md:flex" aria-label="Top governance navigation">
          {HEADER_NAV_ITEMS.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => props.onNavigate(item.key)}
              className={cn(
                'whitespace-nowrap text-sm font-medium transition-colors',
                item.compact ? 'hidden xl:inline-flex' : 'inline-flex',
                props.page === item.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className="truncate text-sm font-semibold md:hidden">{props.title}</span>
        <Button
          type="button"
          variant="outline"
          className="group relative ml-auto hidden h-9 w-48 justify-start rounded-md bg-muted/25 px-3 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent md:inline-flex xl:w-64"
          aria-label="Search governance console"
          aria-keyshortcuts="Meta+K Control+K"
          title="Search"
        >
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <span className="ml-5">Search</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 group-hover:bg-accent lg:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        <div className="flex items-center gap-2">
          {props.badges.map(badge => (
            <span
              key={badge}
              className="hidden rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground lg:inline-flex"
            >
              {badge}
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-md"
            aria-label="指标快照"
            title="指标快照"
            onClick={props.onRefreshMetrics}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="sr-only">指标快照</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-md"
            aria-label="刷新"
            title="刷新"
            onClick={props.onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">刷新</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden h-9 w-9 rounded-md sm:inline-flex"
            aria-label="复制分享链接"
            title="复制分享链接"
            onClick={props.onCopyShareLink}
          >
            <Link2 className="h-4 w-4" />
            <span className="sr-only">复制分享链接</span>
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 rounded-md"
            aria-label="快速创建"
            title="快速创建"
            onClick={props.onQuickCreate}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">快速创建</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
