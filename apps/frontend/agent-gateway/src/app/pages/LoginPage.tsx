import { useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAgentGatewayUiStore } from '../agent-gateway-store';

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { rememberPassword, setRememberPassword } = useAgentGatewayUiStore();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败');
    }
  }
  return (
    <main className="login-shell login-clone-shell">
      <section className="login-brand-panel" aria-label="Agent Gateway 品牌展示">
        <div className="login-brand-content">
          <span>AGENT</span>
          <span>GATEWAY</span>
          <span>API</span>
        </div>
      </section>
      <section className="login-form-panel" aria-label="Agent Gateway 登录">
        <div className="login-form-content">
          <AgentGatewayLoginLogo />
          <form className="login-panel login-clone-panel" onSubmit={submit}>
            <header className="login-card-header">
              <h1>Agent Gateway Management Center</h1>
              <p>请输入账号与管理密钥以访问管理界面</p>
            </header>

            <label>
              用户名:
              <input
                className="login-input"
                placeholder="请输入用户名"
                value={username}
                onChange={event => setUsername(event.target.value)}
              />
            </label>
            <label>
              管理密钥:
              <span className="login-password-field">
                <input
                  className="login-input"
                  placeholder="请输入管理密钥"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                />
                <button
                  aria-label={showPassword ? '隐藏管理密钥' : '显示管理密钥'}
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <label className="login-check-row">
              <input
                checked={rememberPassword}
                type="checkbox"
                onChange={event => setRememberPassword(event.target.checked)}
              />
              记住密码
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="login-submit-button" type="submit">
              登录
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function AgentGatewayLoginLogo() {
  return (
    <svg className="login-logo" viewBox="0 0 64 64" aria-labelledby="agent-gateway-login-logo-title" role="img">
      <title id="agent-gateway-login-logo-title">AGMC 标识</title>
      <defs>
        <linearGradient id="agentGatewayLoginGradient" x1="8" x2="56" y1="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#19b9ca" />
          <stop offset="1" stopColor="#f1df32" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="12" />
      <path d="M32 10 51 21v22L32 54 13 43V21z" />
      <path d="M32 18v28" />
      <path d="M20 25 32 18l12 7" />
      <path d="M20 39 32 46l12-7" />
      <circle cx="32" cy="32" r="6" />
    </svg>
  );
}
