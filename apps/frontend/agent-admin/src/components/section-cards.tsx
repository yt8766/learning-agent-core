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
    <div className="grid auto-rows-min gap-4 md:grid-cols-3">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="aspect-video rounded-[1.75rem] border-none bg-[#f8f8f6] shadow-none">
            <CardHeader className="gap-3 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl bg-white p-2 text-primary shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <Badge
                  variant={item.tone === 'accent' ? 'default' : 'outline'}
                  className="rounded-full border-none bg-white text-muted-foreground"
                >
                  {item.title}
                </Badge>
              </div>
              <CardTitle className="pt-3 text-3xl">{item.value}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 px-6 pb-6 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              Structured console workspace
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
