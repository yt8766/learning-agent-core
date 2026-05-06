import { cn } from '@/utils/utils';

export interface NavigationProgressProps {
  active: boolean;
}

export function NavigationProgress({ active }: NavigationProgressProps) {
  return (
    <div
      aria-hidden={!active}
      aria-label="页面切换加载进度"
      aria-valuetext={active ? '页面切换中' : '页面已就绪'}
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0'
      )}
      data-slot="navigation-progress"
      data-state={active ? 'active' : 'idle'}
      role="progressbar"
    >
      <div
        className={cn(
          'h-full bg-muted-foreground shadow-[0_0_8px_hsl(var(--muted-foreground)/0.45)] transition-transform duration-500 ease-out',
          active ? 'animate-[navigation-progress_1.1s_ease-in-out_infinite]' : '-translate-x-full'
        )}
      />
    </div>
  );
}
