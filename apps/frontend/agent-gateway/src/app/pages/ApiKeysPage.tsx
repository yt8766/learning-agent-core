import type { GatewayApiKey } from '../../api/agent-gateway-api';

interface ApiKeysPageProps {
  items: GatewayApiKey[];
}

export function ApiKeysPage({ items }: ApiKeysPageProps) {
  return (
    <section className="page-stack" aria-label="API Keys">
      <div className="section-heading">
        <h2>API Keys</h2>
        <p>管理代理对外接口使用的客户端 API keys，列表只显示遮罩值。</p>
      </div>
      <form className="command-panel">
        <label>
          Keys
          <textarea name="keys" defaultValue={items.map(item => item.prefix).join('\n')} />
        </label>
        <div className="command-actions">
          <button type="submit">替换全部</button>
          <button type="button">更新</button>
          <button type="button" className="danger-action">
            删除
          </button>
        </div>
      </form>
    </section>
  );
}
