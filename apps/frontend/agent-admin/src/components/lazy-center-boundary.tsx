import { Component, Suspense, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardLoadingState } from '@/pages/dashboard/dashboard-loading-state';

interface LazyCenterBoundaryProps {
  children: ReactNode;
  label: string;
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

  componentDidCatch() {
    // React still requires this lifecycle for class error boundaries.
  }

  render() {
    if (this.state.error) {
      return (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-medium">{this.props.label} 加载失败</p>
            <Button
              onClick={() => this.setState(current => ({ error: null, retryKey: current.retryKey + 1 }))}
              size="sm"
            >
              重试
            </Button>
          </CardContent>
        </Card>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

export function LazyCenterBoundary({ children, label }: LazyCenterBoundaryProps) {
  return (
    <LazyCenterErrorBoundary label={label}>
      <Suspense
        fallback={
          <div>
            <p className="sr-only">{`正在加载 ${label}...`}</p>
            <DashboardLoadingState />
          </div>
        }
      >
        {children}
      </Suspense>
    </LazyCenterErrorBoundary>
  );
}
