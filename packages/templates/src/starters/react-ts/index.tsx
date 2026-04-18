// @ts-nocheck
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import App from './App';
import './styles.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sandpack template render failed', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-shell">
          <div className="error-card">
            <p className="error-caption">Template Error</p>
            <h1>模板渲染失败</h1>
            <p>请刷新页面重试，或重新生成报表代码。</p>
            <button className="primary-button" onClick={() => window.location.reload()} type="button">
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Sandpack root container "#root" was not found.');
}

createRoot(container).render(
  <React.StrictMode>
    <IntlProvider locale="zh-CN" messages={{}}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </IntlProvider>
  </React.StrictMode>
);
