// @ts-nocheck
import { ArrowUpRight, BarChart3, Database, Filter, Sparkles } from 'lucide-react';

const kpiCards = [
  { label: '今日兑换次数', value: '24,891', delta: '+12.4%', tone: 'emerald' },
  { label: '消耗银币量', value: '8.6M', delta: '+8.1%', tone: 'blue' },
  { label: '兑换人数', value: '5,324', delta: '+5.7%', tone: 'amber' }
] as const;

const tableRows = [
  { date: '2026-04-10', app: 'vizz', userType: '新用户', exchanges: '8,912', coins: '2.9M' },
  { date: '2026-04-10', app: 'hotya', userType: '老用户', exchanges: '7,406', coins: '2.5M' },
  { date: '2026-04-09', app: 'vizz', userType: '老用户', exchanges: '4,781', coins: '1.8M' }
] as const;

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="brand-caption">Report Assistant</p>
            <h1>Bonus Center</h1>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-card-header">
            <Filter size={16} />
            <span>筛选条件</span>
          </div>
          <div className="filter-list">
            <label>
              开始日期
              <input defaultValue="2026-04-01" type="date" />
            </label>
            <label>
              结束日期
              <input defaultValue="2026-04-10" type="date" />
            </label>
            <label>
              App
              <select defaultValue="all">
                <option value="all">全部商户</option>
                <option value="vizz">vizz</option>
                <option value="hotya">hotya</option>
              </select>
            </label>
            <label>
              用户类型
              <select defaultValue="all">
                <option value="all">全部用户</option>
                <option value="new">新用户</option>
                <option value="old">老用户</option>
              </select>
            </label>
          </div>
          <button className="primary-button" type="button">
            查询数据
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="workspace-caption">数据报表生成助手</p>
            <h2>银币兑换记录工作台</h2>
          </div>
          <button className="ghost-button" type="button">
            查看接口定义
            <ArrowUpRight size={14} />
          </button>
        </header>

        <section className="hero-card">
          <div>
            <p className="hero-label">当前模板</p>
            <h3>面向 Bonus Center 运营后台的报表骨架</h3>
            <p className="hero-description">
              左侧保留筛选结构，右侧提供指标卡、趋势容器和明细表，方便大模型直接覆盖生成业务代码。
            </p>
          </div>
          <div className="hero-badges">
            <span>React + TypeScript</span>
            <span>Sandpack Ready</span>
            <span>Admin Dashboard</span>
          </div>
        </section>

        <section className="kpi-grid">
          {kpiCards.map(card => (
            <article className="kpi-card" key={card.label}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <span className={`kpi-delta kpi-delta-${card.tone}`}>{card.delta}</span>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="panel panel-chart">
            <div className="panel-header">
              <div>
                <p>趋势概览</p>
                <h3>最近 10 天兑换趋势</h3>
              </div>
              <BarChart3 size={18} />
            </div>
            <div className="chart-placeholder">
              <div className="chart-line" />
              <div className="chart-bars">
                <span style={{ height: '34%' }} />
                <span style={{ height: '58%' }} />
                <span style={{ height: '51%' }} />
                <span style={{ height: '76%' }} />
                <span style={{ height: '64%' }} />
                <span style={{ height: '82%' }} />
              </div>
            </div>
          </article>

          <article className="panel panel-table">
            <div className="panel-header">
              <div>
                <p>明细数据</p>
                <h3>兑换记录 Top Rows</h3>
              </div>
              <Database size={18} />
            </div>
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>App</th>
                  <th>用户类型</th>
                  <th>兑换次数</th>
                  <th>银币消耗</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(row => (
                  <tr key={`${row.date}-${row.app}-${row.userType}`}>
                    <td>{row.date}</td>
                    <td>{row.app}</td>
                    <td>{row.userType}</td>
                    <td>{row.exchanges}</td>
                    <td>{row.coins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>
      </main>
    </div>
  );
}
