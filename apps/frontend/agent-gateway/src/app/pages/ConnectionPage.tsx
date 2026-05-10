export function ConnectionPage() {
  return (
    <section className="page-stack" aria-label="Management API">
      <div className="section-heading">
        <h2>Management API</h2>
        <p>连接远端 CLI Proxy API Management API，management key 只通过写命令提交。</p>
      </div>
      <form className="command-panel">
        <label>
          API Base
          <input name="apiBase" defaultValue="https://remote.router-for.me/v0/management" />
        </label>
        <label>
          Management Key
          <input name="managementKey" type="password" />
        </label>
        <label>
          Timeout
          <input name="timeoutMs" type="number" defaultValue={15000} />
        </label>
        <div className="command-actions">
          <button type="submit">保存连接</button>
          <button type="button">测试连接</button>
        </div>
      </form>
    </section>
  );
}
