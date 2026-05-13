import { BookOpen, Eraser, FileText, GitBranch, Github, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type {
  GatewayRuntimeHealthResponse,
  GatewaySystemModelGroup,
  GatewaySystemVersionResponse
} from '../../api/agent-gateway-api';
import { clearGatewayRefreshToken } from '../../auth/auth-storage';
import claudeIcon from '../assets/provider-icons/claude.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import openaiIcon from '../assets/provider-icons/openai-light.svg';

interface SystemPageProps {
  info: GatewaySystemVersionResponse;
  modelGroups: GatewaySystemModelGroup[];
  onCheckLatestVersion?: () => Promise<unknown> | void;
  onRefreshModels?: () => Promise<unknown> | void;
  onEnableRequestLog?: () => Promise<unknown> | void;
  onClearLocalLoginStorage?: () => Promise<unknown> | void;
  runtimeHealth?: GatewayRuntimeHealthResponse | null;
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
  onEnableRequestLog,
  onRefreshModels,
  runtimeHealth
}: SystemPageProps) {
  const [operationStatus, setOperationStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runOperation = async (label: string, operation: () => Promise<unknown> | unknown): Promise<void> => {
    setBusyAction(label);
    setOperationStatus(null);
    try {
      const result = await operation();
      if (result === undefined) {
        throw new Error('当前页面尚未接入该操作');
      }
      setOperationStatus({ kind: 'success', message: `${label}已完成。` });
    } catch (error) {
      setOperationStatus({ kind: 'error', message: `${label}失败：${getErrorMessage(error)}` });
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearLocalLoginStorage = (): void => {
    void runOperation('清理本地登录态', async () => {
      if (onClearLocalLoginStorage) return onClearLocalLoginStorage();
      clearGatewayRefreshToken();
      return { cleared: true };
    });
  };

  return (
    <section className="system-info-clone gateway-management-page" aria-label="管理中心信息">
      <h1 className="management-page-title">管理中心信息</h1>

      {operationStatus ? (
        <div className={`operation-feedback ${operationStatus.kind}`}>{operationStatus.message}</div>
      ) : null}

      <article className="system-about-card">
        <div className="system-about-header">
          <div className="system-logo-mark">AG</div>
          <h2>Agent Gateway Management Center</h2>
        </div>

        <div className="system-info-grid">
          <article className="system-info-tile">
            <span>Web UI 版本</span>
            <strong>Agent Gateway Core</strong>
          </article>
          <article className="system-info-tile">
            <div>
              <span>API 版本</span>
              <button
                disabled={busyAction === '检查最新版本'}
                type="button"
                onClick={() => void runOperation('检查最新版本', async () => onCheckLatestVersion?.())}
              >
                <RefreshCw size={14} aria-hidden="true" />
                {busyAction === '检查最新版本' ? '检查中' : '检查最新版本'}
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
          <h2>Production Runtime Boundary</h2>
          <p>系统页只展示 agent-server runtime executor 投影，不承载迁移执行入口或后端边界逻辑。</p>
        </header>
        <div className="system-model-list">
          {runtimeHealth ? (
            <>
              <div className="system-model-row">
                <div>
                  <span className="system-model-title">
                    <strong>runtime</strong>
                  </span>
                  <small>
                    {runtimeHealth.checkedAt} / queue {runtimeHealth.usageQueue.pending} / failed{' '}
                    {runtimeHealth.usageQueue.failed}
                  </small>
                </div>
                <span className={`status-pill status-${runtimeHealth.status}`}>{runtimeHealth.status}</span>
              </div>
              {runtimeHealth.cooldowns.length > 0 ? (
                <div className="conflict-list">
                  {runtimeHealth.cooldowns.map(cooldown => (
                    <div className="conflict-row" key={`${cooldown.subjectType}:${cooldown.subjectId}`}>
                      <span>
                        {cooldown.subjectType}:{cooldown.subjectId} {cooldown.reason}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {runtimeHealth.executors.length === 0 ? (
                <div className="hint">暂无 executor</div>
              ) : (
                runtimeHealth.executors.map(executor => (
                  <div className="system-model-row" key={executor.providerKind}>
                    <div>
                      <span className="system-model-title">
                        <strong>{executor.providerKind}</strong>
                      </span>
                      <small>{executor.message ?? executor.checkedAt}</small>
                    </div>
                    <div className="model-chip-row">
                      <span className={`status-pill status-${executor.status}`}>{executor.status}</span>
                      <span className="model-chip">{executor.supportsStreaming ? 'streaming' : 'non-streaming'}</span>
                      <span className="model-chip">{executor.activeRequests} active</span>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="hint">runtime executor 状态待加载</div>
          )}
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
          <button
            disabled={busyAction === '刷新模型'}
            type="button"
            onClick={() => void runOperation('刷新模型', async () => onRefreshModels?.())}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {busyAction === '刷新模型' ? '刷新中' : '刷新'}
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
          <button
            disabled={busyAction === '启用请求日志'}
            type="button"
            onClick={() => void runOperation('启用请求日志', async () => onEnableRequestLog?.())}
          >
            <FileText size={15} aria-hidden="true" />
            {busyAction === '启用请求日志' ? '启用中' : '启用请求日志'}
          </button>
          <button disabled={busyAction === '清理本地登录态'} type="button" onClick={handleClearLocalLoginStorage}>
            <Eraser size={15} aria-hidden="true" />
            {busyAction === '清理本地登录态' ? '清理中' : '清理本地登录态'}
          </button>
        </div>
      </article>
    </section>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '未知错误';
}
