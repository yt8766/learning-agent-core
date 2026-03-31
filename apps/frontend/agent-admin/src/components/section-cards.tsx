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
    <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <Badge variant={item.tone === 'accent' ? 'default' : 'outline'} className="rounded-full">
                  {item.title}
                </Badge>
              </div>
              <CardTitle className="text-3xl">{item.value}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              全站统一使用 shadcn 风格卡片与布局。
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
