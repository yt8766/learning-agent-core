import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface SiteHeaderProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  health: string;
  badges: string[];
  onRefresh: () => void;
  onRefreshMetrics: () => void;
  onQuickCreate: () => void;
  onCopyShareLink: () => void;
}

export function SiteHeader(props: SiteHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 bg-[#fdfdfc] px-4 transition-[width,height] ease-linear">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 border-transparent bg-transparent shadow-none hover:bg-muted/70" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="#">{props.description || '治理控制台'}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{props.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {props.badges.map(badge => (
          <span
            key={badge}
            className="hidden rounded-full border border-border/80 bg-[#f6f6f4] px-2.5 py-1 text-xs text-muted-foreground md:inline-flex"
          >
            {badge}
          </span>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={props.onRefreshMetrics}>
          指标快照
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onRefresh}>
          刷新
        </Button>
      </div>
    </header>
  );
}
