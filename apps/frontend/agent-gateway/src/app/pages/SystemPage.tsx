import { BookOpen, Eraser, FileText, GitBranch, Github, RefreshCw } from 'lucide-react';
import type { GatewaySystemModelGroup, GatewaySystemVersionResponse } from '../../api/agent-gateway-api';
import { clearGatewayRefreshToken } from '../../auth/auth-storage';
import claudeIcon from '../assets/provider-icons/claude.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import openaiIcon from '../assets/provider-icons/openai-light.svg';

interface SystemPageProps {
  info: GatewaySystemVersionResponse;
  modelGroups: GatewaySystemModelGroup[];
  onCheckLatestVersion?: () => void;
  onEnableRequestLog?: () => void;
  onClearLocalLoginStorage?: () => void;
}

const resolveModelIcon = (providerId: string): string | null => {
  if (providerId.includes('gemini')) return geminiIcon;
  if (providerId.includes('claude')) return claudeIcon;
  if (providerId.includes('openai') || providerId.includes('gpt')) return openaiIcon;
  return null;
};

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
    <section className="system-info-clone gateway-management-page" aria-label="管理中心信息">
      <h1 className="management-page-title">管理中心信息</h1>

      <article className="system-about-card">
        <div className="system-about-header">
          <div className="system-logo-mark">AG</div>
          <h2>Agent Gateway Management Center</h2>
        </div>

        <div className="system-info-grid">
          <button className="system-info-tile tap-tile" type="button">
            <span>Web UI 版本</span>
            <strong>Agent Gateway Core</strong>
          </button>
          <article className="system-info-tile">
            <div>
              <span>API 版本</span>
              <button type="button" onClick={onCheckLatestVersion}>
                <RefreshCw size={14} aria-hidden="true" />
                检查最新版本
              </button>
            </div>
            <strong>{info.version}</strong>
            <small>最新版本：{info.latestVersion ?? '-'}</small>
          </article>
          <article className="system-info-tile">
            <span>构建日期</span>
            <strong>{info.buildDate ?? '-'}</strong>
          </article>
          <article className="system-info-tile">
            <span>连接状态</span>
            <strong>{info.updateAvailable ? '有新版本' : '已是最新'}</strong>
            <small>{info.links.help}</small>
          </article>
        </div>
      </article>

      <article className="system-section-card">
        <header>
          <h2>快速链接</h2>
          <p>当前 Agent Gateway 项目入口与参考帮助文档。</p>
        </header>
        <div className="system-link-grid">
          <a href="https://github.com/yt8766/learning-agent-core">
            <span className="system-link-icon github">
              <Github size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>主仓库</strong>
              <small>learning-agent-core</small>
            </span>
          </a>
          <a href="https://github.com/yt8766/learning-agent-core/tree/main/apps/frontend/agent-gateway">
            <span className="system-link-icon code">
              <GitBranch size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>前端源码</strong>
              <small>apps/frontend/agent-gateway</small>
            </span>
          </a>
          <a href={info.links.help}>
            <span className="system-link-icon docs">
              <BookOpen size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>帮助文档</strong>
              <small>help.router-for.me</small>
            </span>
          </a>
        </div>
      </article>

      <article className="system-section-card">
        <header>
          <h2>模型列表</h2>
          <button type="button">
            <RefreshCw size={15} aria-hidden="true" />
            刷新
          </button>
        </header>
        <div className="system-model-list">
          {modelGroups.length === 0 ? (
            <div className="hint">暂无模型</div>
          ) : (
            modelGroups.map(group => {
              const icon = resolveModelIcon(group.providerId);
              return (
                <div className="system-model-row" key={group.providerId}>
                  <div>
                    <span className="system-model-title">
                      {icon && <img src={icon} alt="" />}
                      <strong>{group.providerId}</strong>
                    </span>
                    <small>{group.models.length} 个模型</small>
                  </div>
                  <div className="model-chip-row">
                    {group.models.map(model => (
                      <span className="model-chip" key={model.id}>
                        {model.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>

      <article className="system-section-card">
        <header>
          <h2>登录与请求日志</h2>
          <p>只清理 Agent Gateway refresh token，不触碰浏览器 profile、Cookie 或站点缓存目录。</p>
        </header>
        <div className="system-danger-actions">
          <button type="button" onClick={onEnableRequestLog}>
            <FileText size={15} aria-hidden="true" />
            启用请求日志
          </button>
          <button type="button" onClick={handleClearLocalLoginStorage}>
            <Eraser size={15} aria-hidden="true" />
            清理本地登录态
          </button>
        </div>
      </article>
    </section>
  );
}
