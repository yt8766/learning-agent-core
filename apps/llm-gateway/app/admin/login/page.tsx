import { AdminLoginForm } from '../../../src/admin/admin-login-form';

export default function AdminLoginPage() {
  return (
    <main className="admin-shell">
      <section className="panel login-panel">
        <p className="eyebrow">Private LLM Gateway</p>
        <h1>管理员登录</h1>
        <p>使用后台密码进入私有网关控制台。</p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
