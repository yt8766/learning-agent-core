import { useEffect, useMemo, useState } from 'react';
import type { GatewayLogEntry, GatewaySnapshot, GatewayUsageRecord } from '@agent/core';
import { AgentGatewayApiClient } from '../api/agent-gateway-api';
import { GatewayAuthProvider, useGatewayAuth } from '../auth/auth-session';
import { LoginPage } from './pages/LoginPage';
import './App.css';
export function App() {
  return (
    <GatewayAuthProvider>
      <GatewayShell />
    </GatewayAuthProvider>
  );
}
function GatewayShell() {
  const auth = useGatewayAuth();
  const [snapshot, setSnapshot] = useState<GatewaySnapshot | null>(null);
  const [logs, setLogs] = useState<GatewayLogEntry[]>([]);
  const [usage, setUsage] = useState<GatewayUsageRecord[]>([]);
  const api = useMemo(
    () =>
      new AgentGatewayApiClient({
        getAccessToken: () => auth.accessToken,
        refreshAccessToken: auth.refreshAccessToken
      }),
    [auth.accessToken, auth.refreshAccessToken]
  );
  useEffect(() => {
    if (!auth.accessToken) return;
    Promise.all([api.snapshot(), api.logs(), api.usage()])
      .then(([s, l, u]) => {
        setSnapshot(s);
        setLogs(l.items);
        setUsage(u.items);
      })
      .catch(() => undefined);
  }, [api, auth.accessToken]);
  if (auth.status === 'checking') return <main className="loading-shell">正在恢复会话...</main>;
  if (!auth.accessToken) return <LoginPage onLogin={auth.login} />;
  return (
    <main className="app-shell">
      <aside className="side-nav">
        <div className="brand">Agent Gateway Console</div>
        <button onClick={auth.logout}>退出</button>
      </aside>
      <section className="workspace">
        <h1>Agent Gateway Console</h1>
        <nav>
          <button>总览</button>
          <button>上游方</button>
          <button>认证文件</button>
          <button>配额</button>
          <button>调用管线</button>
          <button>日志与探测</button>
        </nav>
        <div className="overview-grid">
          <article>运行状态：{snapshot?.runtime.status ?? '加载中'}</article>
          <article>输入 token：{snapshot?.config.inputTokenStrategy ?? '-'}</article>
          <article>输出 token：{snapshot?.config.outputTokenStrategy ?? '-'}</article>
          <article>
            日志：{logs.length} 条，用量：{usage.length} 条
          </article>
        </div>
      </section>
    </main>
  );
}
