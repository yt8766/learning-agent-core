export default function AdminLoginPage() {
  return (
    <main className="admin-shell">
      <section className="panel">
        <h1>需要管理员会话</h1>
        <p>
          当前私用网关不会开放后台匿名访问。请在部署环境配置
          <code> LLM_GATEWAY_ADMIN_SESSION_TOKEN </code>
          并设置管理员会话 Cookie 后再进入控制台。
        </p>
      </section>
    </main>
  );
}
