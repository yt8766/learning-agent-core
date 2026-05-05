import { Component, Suspense, type ReactNode } from 'react';
import { Alert, Button, Spin } from 'antd';

interface KnowledgeLazyBoundaryProps {
  children: ReactNode;
  label: string;
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

  componentDidCatch() {
    // React still requires this lifecycle for class error boundaries.
  }

  render() {
    if (this.state.error) {
      return (
        <Alert
          action={
            <Button
              onClick={() => this.setState(current => ({ error: null, retryKey: current.retryKey + 1 }))}
              size="small"
            >
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

export function KnowledgeLazyBoundary({ children, label }: KnowledgeLazyBoundaryProps) {
  return (
    <KnowledgeLazyErrorBoundary label={label}>
      <Suspense fallback={<Spin tip={`正在加载${label}...`} />}>{children}</Suspense>
    </KnowledgeLazyErrorBoundary>
  );
}
