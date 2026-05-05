import { Component, Suspense, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardLoadingState } from '@/pages/dashboard/dashboard-loading-state';

interface LazyCenterBoundaryProps {
  children: ReactNode;
  label: string;
  onRetry?: () => void;
}

interface LazyCenterBoundaryState {
  error: Error | null;
  retryKey: number;
}

class LazyCenterErrorBoundary extends Component<LazyCenterBoundaryProps, LazyCenterBoundaryState> {
  state: LazyCenterBoundaryState = {
    error: null,
    retryKey: 0
  };

  static getDerivedStateFromError(error: Error): Partial<LazyCenterBoundaryState> {
    return { error };
  }

  private handleRetry = () => {
    this.setState(current => ({ error: null, retryKey: current.retryKey + 1 }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      return (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-medium">{this.props.label} 加载失败</p>
            <Button onClick={this.handleRetry} size="sm">
              重试
            </Button>
          </CardContent>
        </Card>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

function reloadCurrentPage() {
  globalThis.location.reload();
}

export function LazyCenterBoundary({ children, label, onRetry = reloadCurrentPage }: LazyCenterBoundaryProps) {
  return (
    <LazyCenterErrorBoundary label={label} onRetry={onRetry}>
      <Suspense fallback={<DashboardLoadingState message={`正在加载 ${label}...`} />}>{children}</Suspense>
    </LazyCenterErrorBoundary>
  );
}
