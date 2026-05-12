import { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import type {
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayProviderSpecificConfigSummary
} from '@agent/core';
import ampIcon from '../assets/provider-icons/amp.svg';
import claudeIcon from '../assets/provider-icons/claude.svg';
import codexIcon from '../assets/provider-icons/codex.svg';
import geminiIcon from '../assets/provider-icons/gemini.svg';
import openaiIcon from '../assets/provider-icons/openai-light.svg';
import vertexIcon from '../assets/provider-icons/vertex.svg';

type ProviderIconId = 'gemini' | 'codex' | 'claude' | 'vertex' | 'openai' | 'ampcode';

type ProviderConfigItem = GatewayProviderSpecificConfigRecord | GatewayProviderSpecificConfigSummary;
type ProviderSectionId = 'gemini' | 'codex' | 'claude' | 'vertex' | 'openai-compatible' | 'ampcode';
type ProviderActionKey = 'save' | 'test' | 'refresh';
type ProviderActionState = 'idle' | 'loading' | 'success' | 'error';

interface ProviderActionStatus {
  state: ProviderActionState;
  message?: string;
}

type ProviderSectionActionState = Record<ProviderSectionId, ProviderActionStatus>;

interface ProviderFormDraft {
  displayName: string;
  enabled: boolean;
  baseUrl: string;
  prefix: string;
  proxyUrl: string;
  priority: string;
  authIndex: string;
  testModel: string;
  modelsText: string;
  excludedModelsText: string;
  headersText: string;
}

const providerSections = [
  {
    id: 'gemini',
    title: 'Gemini API 密钥',
    emptyTitle: '暂无Gemini密钥',
    emptyDetail: '点击上方按钮添加第一个密钥',
    addAction: '添加密钥',
    detail: 'API Key、项目路由和模型族 allowlist。',
    actions: ['保存密钥槽', '测试提供商', '刷新模型'],
    icon: 'gemini'
  },
  {
    id: 'codex',
    title: 'Codex API 配置',
    emptyTitle: '暂无Codex配置',
    emptyDetail: '点击上方按钮添加第一个配置',
    addAction: '添加配置',
    detail: 'Codex 上游路由、审批模式与执行 profile。',
    actions: ['绑定 profile', '验证路由', '检查模型'],
    icon: 'codex'
  },
  {
    id: 'claude',
    title: 'Claude API 配置',
    emptyTitle: '暂无Claude配置',
    emptyDetail: '点击上方按钮添加第一个配置',
    addAction: '添加配置',
    detail: 'Anthropic 兼容凭据 profile 与模型族控制。',
    actions: ['保存凭据', '探测端点', '同步模型列表'],
    icon: 'claude'
  },
  {
    id: 'vertex',
    title: 'Vertex API 配置',
    emptyTitle: '暂无Vertex配置',
    emptyDetail: '点击上方按钮导入服务账号配置',
    addAction: '导入配置',
    detail: 'Google Cloud 项目、区域、服务账号与导入边界。',
    actions: ['导入 Vertex 配置', '测试 IAM', '列出 Vertex 模型'],
    icon: 'vertex'
  },
  {
    id: 'openai-compatible',
    title: 'OpenAI 兼容配置',
    emptyTitle: '暂无OpenAI兼容配置',
    emptyDetail: '点击上方按钮添加第一个兼容端点',
    addAction: '添加配置',
    detail: 'Base URL、headers、模型发现和显式测试模型。',
    actions: ['模型发现', '测试模型', '保存兼容端点'],
    icon: 'openai'
  },
  {
    id: 'ampcode',
    title: 'Ampcode 桥接配置',
    emptyTitle: '暂无Ampcode配置',
    emptyDetail: '点击上方按钮添加第一个桥接配置',
    addAction: '添加配置',
    detail: 'Ampcode bridge 的上游密钥映射、模型映射和强制映射。',
    actions: ['上游密钥映射', '模型映射', '强制映射'],
    icon: 'ampcode'
  }
] satisfies Array<{
  id: ProviderSectionId;
  title: string;
  emptyTitle: string;
  emptyDetail: string;
  addAction: string;
  detail: string;
  actions: string[];
  icon: ProviderIconId;
}>;

const providerIcons = {
  gemini: geminiIcon,
  codex: codexIcon,
  claude: claudeIcon,
  vertex: vertexIcon,
  openai: openaiIcon,
  ampcode: ampIcon
};

interface ProviderConfigPageProps {
  configs?: GatewayProviderSpecificConfigListResponse;
  onRefreshModels?: (providerId: string) => Promise<unknown> | void;
  onTestModel?: (providerId: string, model: string) => Promise<unknown> | void;
  onSaveProvider?: (config: GatewayProviderSpecificConfigRecord) => Promise<unknown> | void;
  onAddProvider?: (providerId: string) => Promise<unknown> | void;
}

export function ProviderConfigPage({
  configs = { items: [] },
  onRefreshModels,
  onSaveProvider,
  onTestModel,
  onAddProvider
}: ProviderConfigPageProps) {
  const [sectionActionStatuses, setSectionActionStatuses] = useState<ProviderSectionActionState>(
    createInitialSectionActionStatuses()
  );

  const updateSectionActionStatus = (sectionId: ProviderSectionId, status: ProviderActionStatus): void => {
    setSectionActionStatuses(current => ({ ...current, [sectionId]: status }));
  };

  const runProviderSectionAction = async (
    sectionId: ProviderSectionId,
    callback: (() => Promise<unknown> | void) | undefined,
    loadingMessage: string,
    successMessage: string
  ): Promise<void> => {
    if (!callback) {
      updateSectionActionStatus(sectionId, { state: 'error', message: '当前页面未接入该操作。' });
      return;
    }

    updateSectionActionStatus(sectionId, { state: 'loading', message: loadingMessage });
    try {
      await callback();
      updateSectionActionStatus(sectionId, { state: 'success', message: successMessage });
    } catch (error) {
      updateSectionActionStatus(sectionId, { state: 'error', message: getErrorMessage(error) });
    }
  };

  const handleSectionAction = (sectionId: ProviderSectionId, action: string): void => {
    if (action === '模型发现' || action === '刷新模型' || action === '检查模型' || action === '同步模型列表') {
      void runProviderSectionAction(
        sectionId,
        onRefreshModels ? () => onRefreshModels(sectionId) : undefined,
        '模型刷新中...',
        '模型刷新请求已提交。'
      );
      return;
    }
    if (action === '测试模型' || action === '测试提供商' || action === '探测端点' || action === '测试') {
      void runProviderSectionAction(
        sectionId,
        onTestModel ? () => onTestModel(sectionId, 'default') : undefined,
        '测试中...',
        '测试已提交。'
      );
      return;
    }
    if (action === sectionMatchAction(sectionId)) {
      void runProviderSectionAction(
        sectionId,
        onAddProvider ? () => onAddProvider(sectionId) : undefined,
        '请求提交中...',
        '请求已提交。'
      );
      return;
    }

    updateSectionActionStatus(sectionId, {
      state: 'error',
      message: `不支持的操作：${action}`
    });
  };

  return (
    <section className="provider-config-clone gateway-management-page" aria-label="AI 提供商配置">
      <h1 className="management-page-title">AI 提供商配置</h1>

      <div className="provider-config-list">
        {providerSections.map(section => {
          const sectionConfigs = configs.items.filter(config =>
            sectionMatchesProvider(section.id, getProviderType(config))
          );
          const sectionStatus = sectionActionStatuses[section.id] ?? { state: 'idle' };
          return (
            <article className="provider-config-card" id={section.id} key={section.id}>
              <header className="provider-card-header">
                <span className="provider-title-wrap">
                  <img className="provider-brand-icon" src={providerIcons[section.icon]} alt="" />
                  <span>{section.title}</span>
                </span>
                <div className="provider-section-header-actions">
                  <button
                    disabled={sectionStatus.state === 'loading'}
                    type="button"
                    onClick={() => handleSectionAction(section.id, section.addAction)}
                  >
                    {section.addAction}
                  </button>
                  <ActionStatusText status={sectionStatus} />
                </div>
              </header>
              {sectionConfigs.length > 0 ? (
                <div className="provider-config-record-list">
                  {sectionConfigs.map(config => (
                    <ProviderConfigRecordCard
                      config={config}
                      key={config.id}
                      onRefreshModels={onRefreshModels}
                      onSaveProvider={onSaveProvider}
                      onTestModel={onTestModel}
                    />
                  ))}
                </div>
              ) : (
                <div className="provider-empty-state">
                  <span className="provider-empty-icon">
                    <Archive size={30} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{section.emptyTitle}</h3>
                    <p>{section.emptyDetail}</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <nav className="provider-floating-nav" aria-label="AI 提供商快捷导航">
        {providerSections.map(section => (
          <a href={`#${section.id}`} key={section.id} aria-label={section.title}>
            <img src={providerIcons[section.icon]} alt="" />
          </a>
        ))}
      </nav>
    </section>
  );
}

function ProviderConfigRecordCard({
  config,
  onRefreshModels,
  onSaveProvider,
  onTestModel
}: {
  config: ProviderConfigItem;
  onRefreshModels?: (providerId: string) => Promise<unknown> | void;
  onSaveProvider?: (config: GatewayProviderSpecificConfigRecord) => Promise<unknown> | void;
  onTestModel?: (providerId: string, model: string) => Promise<unknown> | void;
}) {
  const isRecordConfig = isProviderConfigRecord(config);
  const providerType = getProviderType(config);
  const [draft, setDraft] = useState<ProviderFormDraft>(() => createProviderDraft(config));
  const [actionStatuses, setActionStatuses] =
    useState<Record<ProviderActionKey, ProviderActionStatus>>(createInitialActionStatuses);
  const draftModels = isRecordConfig ? parseProviderModels(draft.modelsText, config.models) : [];
  const testModel = isRecordConfig
    ? draft.testModel.trim() || (draftModels[0]?.name ?? config.testModel ?? config.models[0]?.name ?? 'default')
    : 'default';
  const modelCount = isRecordConfig ? draftModels.length : config.modelCount;
  const credentials = isRecordConfig ? config.credentials : [];
  const models = isRecordConfig ? draftModels : [];
  const canSave = Boolean(onSaveProvider) && isRecordConfig;
  const excludedModelCount = isRecordConfig ? splitListInput(draft.excludedModelsText).length : 0;

  useEffect(() => {
    setDraft(createProviderDraft(config));
    setActionStatuses(createInitialActionStatuses());
  }, [config]);

  const updateDraftField = <Key extends keyof ProviderFormDraft>(key: Key, value: ProviderFormDraft[Key]): void => {
    setDraft(previousDraft => ({ ...previousDraft, [key]: value }));
  };

  const updateActionStatus = (action: ProviderActionKey, status: ProviderActionStatus): void => {
    setActionStatuses(previousStatuses => ({ ...previousStatuses, [action]: status }));
  };

  const runProviderAction = async (
    action: ProviderActionKey,
    callback: (() => Promise<unknown> | void) | undefined,
    loadingMessage: string,
    successMessage: string
  ): Promise<void> => {
    if (!callback) {
      updateActionStatus(action, { state: 'error', message: '当前页面未配置回调' });
      return;
    }
    updateActionStatus(action, { state: 'loading', message: loadingMessage });
    try {
      await callback();
      updateActionStatus(action, { state: 'success', message: successMessage });
    } catch (error) {
      updateActionStatus(action, { state: 'error', message: getErrorMessage(error) });
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!isRecordConfig) return;
    let nextConfig: GatewayProviderSpecificConfigRecord;
    try {
      nextConfig = buildProviderConfigRecord(config, draft);
    } catch (error) {
      updateActionStatus('save', { state: 'error', message: getErrorMessage(error) });
      return;
    }
    await runProviderAction('save', () => onSaveProvider?.(nextConfig), '保存中...', '保存成功');
  };

  const handleTestModel = async (): Promise<void> => {
    await runProviderAction('test', () => onTestModel?.(providerType, testModel), '测试中...', '测试成功');
  };

  const handleRefreshModels = async (): Promise<void> => {
    await runProviderAction('refresh', () => onRefreshModels?.(providerType), '刷新中...', '刷新成功');
  };

  return (
    <article className="provider-config-record">
      <div className="provider-config-record-main">
        <div>
          <span className={`status-pill provider-${config.enabled ? 'enabled' : 'disabled'}`}>
            {config.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <h3>{config.displayName}</h3>
          <p>{isRecordConfig ? (config.baseUrl ?? '使用默认上游地址') : '使用默认上游地址'}</p>
        </div>
        <small>{config.id}</small>
      </div>
      <div className="provider-config-meta-grid">
        <span>
          <strong>{modelCount}</strong>
          模型
        </span>
        <span>
          <strong>{credentials.length}</strong>
          凭据
        </span>
        <span>
          <strong>{excludedModelCount}</strong>
          排除
        </span>
      </div>
      {isRecordConfig ? (
        <div className="provider-config-edit-grid">
          <label>
            <span>displayName</span>
            <input
              type="text"
              value={draft.displayName}
              onChange={event => updateDraftField('displayName', event.target.value)}
            />
          </label>
          <label>
            <span>enabled</span>
            <input
              checked={draft.enabled}
              type="checkbox"
              onChange={event => updateDraftField('enabled', event.target.checked)}
            />
          </label>
          <label>
            <span>baseUrl</span>
            <input
              placeholder="使用默认上游地址"
              type="url"
              value={draft.baseUrl}
              onChange={event => updateDraftField('baseUrl', event.target.value)}
            />
          </label>
          <label>
            <span>prefix</span>
            <input
              type="text"
              value={draft.prefix}
              onChange={event => updateDraftField('prefix', event.target.value)}
            />
          </label>
          <label>
            <span>proxyUrl</span>
            <input
              type="url"
              value={draft.proxyUrl}
              onChange={event => updateDraftField('proxyUrl', event.target.value)}
            />
          </label>
          <label>
            <span>priority</span>
            <input
              inputMode="numeric"
              type="number"
              value={draft.priority}
              onChange={event => updateDraftField('priority', event.target.value)}
            />
          </label>
          <label>
            <span>authIndex</span>
            <input
              inputMode="numeric"
              type="number"
              value={draft.authIndex}
              onChange={event => updateDraftField('authIndex', event.target.value)}
            />
          </label>
          <label>
            <span>testModel</span>
            <input
              type="text"
              value={draft.testModel}
              onChange={event => updateDraftField('testModel', event.target.value)}
            />
          </label>
          <label>
            <span>models</span>
            <textarea
              rows={4}
              value={draft.modelsText}
              onChange={event => updateDraftField('modelsText', event.target.value)}
            />
          </label>
          <label>
            <span>excludedModels</span>
            <textarea
              rows={3}
              value={draft.excludedModelsText}
              onChange={event => updateDraftField('excludedModelsText', event.target.value)}
            />
          </label>
          <label>
            <span>headers</span>
            <textarea
              placeholder={'{\n  "Authorization": "Bearer ..."\n}'}
              rows={4}
              value={draft.headersText}
              onChange={event => updateDraftField('headersText', event.target.value)}
            />
          </label>
        </div>
      ) : null}
      <div className="provider-model-chip-row">
        {models.length > 0 ? (
          models.map(model => (
            <span className="model-chip" key={`${config.id}-${model.name}`}>
              {model.alias ? `${model.name} -> ${model.alias}` : model.name}
            </span>
          ))
        ) : (
          <span className="model-chip muted">未配置模型</span>
        )}
      </div>
      <div className="provider-credential-row">
        {credentials.length > 0 ? (
          credentials.map(credential => (
            <span key={credential.credentialId}>
              {credential.apiKeyMasked ?? credential.authIndex ?? credential.credentialId}
              <strong>{credential.status}</strong>
            </span>
          ))
        ) : (
          <span>暂无凭据</span>
        )}
      </div>
      <div className="provider-record-actions">
        <button disabled={!canSave || actionStatuses.save.state === 'loading'} type="button" onClick={handleSave}>
          保存
        </button>
        <ActionStatusText status={actionStatuses.save} />
        <button disabled={actionStatuses.test.state === 'loading'} type="button" onClick={handleTestModel}>
          测试模型
        </button>
        <ActionStatusText status={actionStatuses.test} />
        <button disabled={actionStatuses.refresh.state === 'loading'} type="button" onClick={handleRefreshModels}>
          刷新模型
        </button>
        <ActionStatusText status={actionStatuses.refresh} />
      </div>
    </article>
  );
}

function ActionStatusText({ status }: { status: ProviderActionStatus }) {
  if (status.state === 'idle') return null;
  return <span className={`provider-action-status provider-action-${status.state}`}>{status.message}</span>;
}

function createInitialActionStatuses(): Record<ProviderActionKey, ProviderActionStatus> {
  return {
    save: { state: 'idle' },
    test: { state: 'idle' },
    refresh: { state: 'idle' }
  };
}

function createInitialSectionActionStatuses(): ProviderSectionActionState {
  return providerSections.reduce((acc, section) => {
    acc[section.id] = { state: 'idle' };
    return acc;
  }, {} as ProviderSectionActionState);
}

function sectionMatchAction(sectionId: ProviderSectionId): string {
  const section = providerSections.find(item => item.id === sectionId);
  return section?.addAction ?? '添加配置';
}

function createProviderDraft(config: ProviderConfigItem): ProviderFormDraft {
  if (!isProviderConfigRecord(config)) {
    return {
      displayName: config.displayName,
      enabled: config.enabled,
      baseUrl: '',
      prefix: '',
      proxyUrl: '',
      priority: '',
      authIndex: '',
      testModel: '',
      modelsText: '',
      excludedModelsText: '',
      headersText: ''
    };
  }

  return {
    displayName: config.displayName,
    enabled: config.enabled,
    baseUrl: config.baseUrl ?? '',
    prefix: config.prefix ?? '',
    proxyUrl: config.proxyUrl ?? '',
    priority: String(config.priority ?? 0),
    authIndex: config.authIndex == null ? '' : String(config.authIndex),
    testModel: config.testModel ?? config.models[0]?.name ?? '',
    modelsText: formatProviderModels(config.models),
    excludedModelsText: config.excludedModels.join('\n'),
    headersText: formatHeaders(config.headers)
  };
}

export function buildProviderConfigRecord(
  config: GatewayProviderSpecificConfigRecord,
  draft: ProviderFormDraft
): GatewayProviderSpecificConfigRecord {
  return {
    ...config,
    displayName: draft.displayName.trim() || config.displayName,
    enabled: draft.enabled,
    baseUrl: toNullableString(draft.baseUrl),
    prefix: toOptionalString(draft.prefix),
    proxyUrl: toOptionalString(draft.proxyUrl),
    priority: parseOptionalNumber(draft.priority, 'priority'),
    authIndex: toOptionalString(draft.authIndex),
    testModel: toOptionalString(draft.testModel),
    models: parseProviderModels(draft.modelsText, config.models),
    excludedModels: splitListInput(draft.excludedModelsText),
    headers: parseHeaders(draft.headersText)
  };
}

function formatProviderModels(models: GatewayProviderSpecificConfigRecord['models']): string {
  return models.map(model => (model.alias ? `${model.name} -> ${model.alias}` : model.name)).join('\n');
}

function parseProviderModels(
  value: string,
  previousModels: GatewayProviderSpecificConfigRecord['models']
): GatewayProviderSpecificConfigRecord['models'] {
  return splitListInput(value).map(modelLine => {
    const [nameInput, aliasInput] = modelLine.split(/\s*->\s*/, 2);
    const name = nameInput.trim();
    const alias = aliasInput?.trim();
    const previousModel = previousModels.find(model => model.name === name);
    return {
      ...previousModel,
      name,
      ...(alias ? { alias } : {})
    };
  });
}

function formatHeaders(headers: GatewayProviderSpecificConfigRecord['headers']): string {
  if (!headers || Object.keys(headers).length === 0) return '';
  return JSON.stringify(headers, null, 2);
}

function parseHeaders(value: string): GatewayProviderSpecificConfigRecord['headers'] {
  const trimmedValue = value.trim();
  if (!trimmedValue) return {};
  if (trimmedValue.startsWith('{')) {
    const parsedValue: unknown = JSON.parse(trimmedValue);
    if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
      throw new Error('headers 必须是 JSON object');
    }
    return Object.fromEntries(
      Object.entries(parsedValue).map(([key, headerValue]) => [key, String(headerValue)])
    ) as GatewayProviderSpecificConfigRecord['headers'];
  }
  return Object.fromEntries(
    trimmedValue.split('\n').flatMap(line => {
      const [key, ...valueParts] = line.split(/[:=]/);
      const headerKey = key.trim();
      const headerValue = valueParts.join(':').trim();
      return headerKey ? [[headerKey, headerValue]] : [];
    })
  ) as GatewayProviderSpecificConfigRecord['headers'];
}

function splitListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function toOptionalString(value: string): string | undefined {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function toNullableString(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseRequiredNumber(value: string, fieldName: string): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${fieldName} 必须是数字`);
  }
  return parsedValue;
}

function parseOptionalNumber(value: string, fieldName: string): number | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;
  return parseRequiredNumber(trimmedValue, fieldName);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '操作失败';
}

function sectionMatchesProvider(
  sectionId: ProviderSectionId,
  providerType:
    | GatewayProviderSpecificConfigRecord['providerType']
    | GatewayProviderSpecificConfigSummary['providerKind']
): boolean {
  if (sectionId === 'openai-compatible') return providerType === 'openaiCompatible';
  return sectionId === providerType;
}

function getProviderType(
  config: ProviderConfigItem
): GatewayProviderSpecificConfigRecord['providerType'] | GatewayProviderSpecificConfigSummary['providerKind'] {
  return isProviderConfigRecord(config) ? config.providerType : config.providerKind;
}

function isProviderConfigRecord(config: ProviderConfigItem): config is GatewayProviderSpecificConfigRecord {
  return 'providerType' in config && 'models' in config && 'credentials' in config && 'excludedModels' in config;
}
