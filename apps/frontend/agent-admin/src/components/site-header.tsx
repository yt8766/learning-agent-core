import { Activity, Plus, RefreshCcw, Share2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SiteHeaderProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  health: string;
  badges: string[];
  onRefresh: () => void;
  onQuickCreate: () => void;
  onCopyShareLink: () => void;
}

export function SiteHeader(props: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur lg:px-6">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">{props.icon}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{props.title}</h1>
                <Badge variant="outline" className="gap-1 rounded-full">
                  <Activity className="h-3.5 w-3.5" />
                  {props.health}
                </Badge>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{props.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {props.badges.map(badge => (
                  <span key={badge}>
                    <Badge variant="secondary" className="rounded-full">
                      {badge}
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="outline" className="rounded-2xl" onClick={props.onCopyShareLink}>
              <Share2 className="h-4 w-4" />
              复制分享链接
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={props.onRefresh} disabled={props.loading}>
              <RefreshCcw className={cn('h-4 w-4', props.loading ? 'animate-spin' : '')} />
              刷新
            </Button>
            <Button className="rounded-2xl" onClick={props.onQuickCreate} disabled={props.loading}>
              <Plus className="h-4 w-4" />
              新建审计任务
            </Button>
          </div>
        </div>
      </Card>
    </header>
  );
}
