import { Component, Suspense, type ReactNode } from 'react';
import { Alert, Button, Spin } from 'antd';

interface KnowledgeLazyBoundaryProps {
  children: ReactNode;
  label: string;
  onRetry?: () => void;
}

interface KnowledgeLazyBoundaryState {
  error: Error | null;
  retryKey: number;
}

class KnowledgeLazyErrorBoundary extends Component<KnowledgeLazyBoundaryProps, KnowledgeLazyBoundaryState> {
  state: KnowledgeLazyBoundaryState = {
    error: null,
    retryKey: 0
  };

  static getDerivedStateFromError(error: Error): Partial<KnowledgeLazyBoundaryState> {
    return { error };
  }

  private handleRetry = () => {
    this.setState(current => ({ error: null, retryKey: current.retryKey + 1 }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      return (
        <Alert
          action={
            <Button onClick={this.handleRetry} size="small">
              重试
            </Button>
          }
          message={`${this.props.label}加载失败`}
          showIcon
          type="error"
        />
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

function reloadCurrentPage() {
  globalThis.location.reload();
}

export function KnowledgeLazyBoundary({ children, label, onRetry = reloadCurrentPage }: KnowledgeLazyBoundaryProps) {
  return (
    <KnowledgeLazyErrorBoundary label={label} onRetry={onRetry}>
      <Suspense fallback={<Spin tip={`正在加载${label}...`} />}>{children}</Suspense>
    </KnowledgeLazyErrorBoundary>
  );
}
