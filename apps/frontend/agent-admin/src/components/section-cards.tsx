import { ArrowRight, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SectionCardItem {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: 'default' | 'accent';
}

export function SectionCards({ items }: { items: SectionCardItem[] }) {
  return (
    <div className="grid auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="min-h-36">
            <CardHeader className="gap-2 px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <Badge
                  variant={item.tone === 'accent' ? 'default' : 'outline'}
                  className="rounded-md border-border bg-background text-muted-foreground"
                >
                  {item.title}
                </Badge>
              </div>
              <CardTitle className="pt-4 text-2xl font-bold tracking-normal">{item.value}</CardTitle>
              <CardDescription className="text-xs">{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 px-6 pb-2 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              Control plane workspace
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
