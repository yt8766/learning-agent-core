import { useState } from 'react';
import type { FormEvent } from 'react';
export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败');
    }
  }
  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <h1>Agent Gateway Console</h1>
        <p>登录中转控制台，查看上游通道、认证文件、配额和 token 处理链路。</p>
        <label>
          用户名
          <input value={username} onChange={event => setUsername(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button type="submit">登录</button>
      </form>
    </main>
  );
}
