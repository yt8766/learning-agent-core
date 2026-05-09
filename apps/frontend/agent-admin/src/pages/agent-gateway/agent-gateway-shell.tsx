import {
  ChevronLeft,
  Cpu,
  FileCheck2,
  Gauge,
  LayoutDashboard,
  Network,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

type GatewayRouteKey = 'dashboard' | 'config' | 'aiProviders' | 'authFiles' | 'oauth' | 'quota' | 'system';

type GatewayRoute = {
  key: GatewayRouteKey;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

const GATEWAY_ROUTES: GatewayRoute[] = [
  { key: 'dashboard', label: '仪表盘', path: '/', icon: LayoutDashboard },
  { key: 'config', label: '配置面板', path: '/config', icon: SlidersHorizontal },
  { key: 'aiProviders', label: 'AI提供商', path: '/ai-providers', icon: Network },
  { key: 'authFiles', label: '认证文件', path: '/auth-files', icon: FileCheck2 },
  { key: 'oauth', label: 'OAuth登录', path: '/oauth', icon: ShieldCheck },
  { key: 'quota', label: '配额管理', path: '/quota', icon: Gauge },
  { key: 'system', label: '中心信息', path: '/system', icon: Cpu }
];

export function AgentGatewayShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <main className="agent-gateway-shell">
      <aside className="gateway-sidebar" aria-label="Agent Gateway 导航">
        <div className="gateway-brand">
          <div className="gateway-brand-mark">
            <Network className="size-7" />
          </div>
          <strong>AGMC</strong>
        </div>
        <nav className="gateway-nav">
          {GATEWAY_ROUTES.map(item => {
            const Icon = item.icon;
            const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link
                className={active ? 'is-active' : undefined}
                data-gateway-nav-item={item.key}
                key={item.key}
                to={item.path}
              >
                <span>
                  <Icon className="size-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <button aria-label="收起侧栏" className="gateway-sidebar-toggle" type="button">
        <ChevronLeft className="size-6" />
      </button>
      <section className="gateway-content">{children}</section>
    </main>
  );
}
