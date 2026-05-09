import { RefreshCw } from 'lucide-react';

import { AgentGatewayShell } from './agent-gateway-shell';
import { useAgentGatewayStore } from './agent-gateway-store';

export function AgentGatewayConfigPage() {
  const configTab = useAgentGatewayStore(state => state.configTab);
  const setConfigTab = useAgentGatewayStore(state => state.setConfigTab);

  return (
    <AgentGatewayShell>
      <section className="gateway-config-header">
        <div>
          <span>CONFIGURATION</span>
          <h1>配置面板</h1>
          <p>以可视化表单和源码模式维护网关 YAML，保存前先查看差异。</p>
        </div>
        <div className="gateway-config-status">
          <strong>已连接</strong>
          <small>当前配置可编辑</small>
        </div>
      </section>
      <section className="gateway-card gateway-config-workspace">
        <header>
          <div className="gateway-config-tabs" aria-label="配置编辑模式">
            <button
              className={configTab === 'visual' ? 'is-active' : undefined}
              onClick={() => setConfigTab('visual')}
              type="button"
            >
              可视化配置
            </button>
            <button
              className={configTab === 'source' ? 'is-active' : undefined}
              onClick={() => setConfigTab('source')}
              type="button"
            >
              源码 YAML
            </button>
          </div>
          <div className="gateway-actions">
            <button className="gateway-secondary-button" type="button">
              <RefreshCw className="size-4" />
              刷新
            </button>
            <button className="gateway-primary-button" type="button">
              保存
            </button>
          </div>
        </header>
        <div className="gateway-config-editor-grid">
          <div>
            <h2>基础设置</h2>
            <label>
              管理密钥
              <input defaultValue="1 个可用密钥" />
            </label>
            <label>
              路由策略
              <select defaultValue="fill-first">
                <option value="fill-first">优先填充</option>
                <option value="round-robin">轮询</option>
              </select>
            </label>
            <label>
              请求重试
              <input defaultValue="2" />
            </label>
          </div>
          <div className="gateway-config-source">
            <span>{configTab === 'visual' ? '预览 YAML' : 'config.yaml'}</span>
            <pre>
              {configTab === 'visual'
                ? 'api-keys:\n  - agmc-admin-key\nrouting-strategy: fill-first\nrequest-timeout: 120'
                : 'commercial-mode: false\nrouting-strategy: fill-first\nrequest-timeout: 120'}
            </pre>
          </div>
        </div>
      </section>
    </AgentGatewayShell>
  );
}
