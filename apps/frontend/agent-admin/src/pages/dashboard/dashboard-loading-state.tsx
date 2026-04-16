import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardLoadingState() {
  return (
    <div className="grid gap-6 px-4 py-6 lg:px-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-border/70 bg-card/90 shadow-sm">
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
