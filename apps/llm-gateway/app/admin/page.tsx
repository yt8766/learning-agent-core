import { summarizeDashboard } from '../../src/admin/admin-dashboard-data';
import { AdminAuthGate } from '../../src/admin/admin-auth-gate';

const summary = summarizeDashboard([]);

const metrics = [
  { label: '今日请求', value: String(summary.requestCount) },
  { label: '今日 Token', value: String(summary.totalTokens) },
  { label: '估算成本', value: `$${summary.estimatedCost.toFixed(2)}` },
  { label: '失败率', value: `${Math.round(summary.failureRate * 100)}%` }
];

export default async function AdminPage() {
  return (
    <AdminAuthGate>
      <main className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Private LLM Gateway</p>
            <h1>控制台</h1>
          </div>
          <span className="status-pill">本地配置</span>
        </header>

        <section className="metrics-grid" aria-label="Gateway metrics">
          {metrics.map(metric => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="panel">
          <div>
            <h2>后台入口已就绪</h2>
            <p>当前应用已提供私用网关骨架、OpenAI-compatible 路由、虚拟 API Key 边界和模型路由基础。</p>
          </div>
        </section>

        <section className="panel">
          <div>
            <h2>Codex 会员额度</h2>
            <p>Codex Plus / Pro 不能作为本中转站 provider。需要查看会员额度时，请跳转到官方 Codex 用量页。</p>
            <a href="https://chatgpt.com/codex/settings/usage" rel="noreferrer" target="_blank">
              打开 Codex usage
            </a>
          </div>
        </section>
      </main>
    </AdminAuthGate>
  );
}
