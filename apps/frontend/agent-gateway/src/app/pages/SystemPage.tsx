import type { GatewaySystemModelGroup, GatewaySystemVersionResponse } from '../../api/agent-gateway-api';
import { clearGatewayRefreshToken } from '../../auth/auth-storage';

interface SystemPageProps {
  info: GatewaySystemVersionResponse;
  modelGroups: GatewaySystemModelGroup[];
  onCheckLatestVersion?: () => void;
  onEnableRequestLog?: () => void;
  onClearLocalLoginStorage?: () => void;
}

export function SystemPage({
  info,
  modelGroups,
  onCheckLatestVersion,
  onClearLocalLoginStorage,
  onEnableRequestLog
}: SystemPageProps) {
  const handleClearLocalLoginStorage = (): void => {
    if (onClearLocalLoginStorage) {
      onClearLocalLoginStorage();
      return;
    }
    clearGatewayRefreshToken();
  };

  return (
    <section className="page-stack" aria-label="System">
      <div className="section-heading">
        <h2>System</h2>
        <p>查看 CLI Proxy API 版本、文档链接和 /v1/models 分组。</p>
      </div>
      <div className="detail-panel">
        <p>Version: {info.version}</p>
        <p>Build: {info.buildDate ?? '-'}</p>
        <p>Latest: {info.latestVersion ?? '-'}</p>
        <a href={info.links.help}>Help</a>
        <button type="button" onClick={onCheckLatestVersion}>
          检查最新版本 / Check latest version
        </button>
        <button type="button" onClick={onEnableRequestLog}>
          Enable request log
        </button>
        <button type="button" onClick={handleClearLocalLoginStorage}>
          Clear local login storage
        </button>
      </div>
      {modelGroups.map(group => (
        <article className="detail-panel" key={group.providerId}>
          <h3>{group.providerId}</h3>
          <p>{group.models.map(model => model.displayName).join(', ')}</p>
        </article>
      ))}
    </section>
  );
}
